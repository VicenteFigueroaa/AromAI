import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase'; // Asegúrate de que la ruta coincida con donde guardaste tu cliente
import { createClient } from '@supabase/supabase-js'; // Añade esta línea
import { createClient as createSSRClient } from '@/utils/supabase/server';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

// Inicializamos el SDK de Google con la variable de entorno secreta
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchPerfumeImageUrl(brand: string, name: string, concentration: string): Promise<string | null> {
  try {
    const query = `${brand} ${name} ${concentration} perfume bottle`;

    const serperResponse = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, num: 10 })
    });

    const serperData = await serperResponse.json();
    const images = serperData.images ?? [];

    for (const img of images) {
      const url: string = img.imageUrl ?? '';
      if (url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) ||
        url.includes('fragrantica.com') ||
        url.includes('wikimedia.org') ||
        url.includes('cloudinary.com')) {
        return url;
      }
    }

    return null;
  } catch (e) {
    console.warn('⚠️ Serper image search falló:', e);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { perfumeName, imageBase64, imageMimeType } = body;

    if (!perfumeName && !imageBase64) {
      return NextResponse.json({ error: 'Falta el nombre del perfume o una imagen' }, { status: 400 });
    }

    // --- FASE 4: ECONOMÍA Y MONETIZACIÓN ---
    // Verificar si el usuario está logueado y tiene créditos ANTES de cualquier búsqueda
    const ssrSupabase = await createSSRClient();
    const { data: { user } } = await ssrSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        error: 'AUTH_REQUIRED',
        message: 'Inicia sesión para analizar fragancias.'
      }, { status: 401 });
    }

    // Verificar créditos y estado premium
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('search_credits, is_pro')
      .eq('id', user.id)
      .single();

    const isPro = profile?.is_pro || false;

    if (!isPro && (!profile || profile.search_credits <= 0)) {
      return NextResponse.json({
        error: 'NO_CREDITS',
        message: 'Te has quedado sin créditos. Recarga viendo un anuncio.'
      }, { status: 403 });
    }
    // ---------------------------------------

    // Detectar si el usuario especificó una concentración explícita en el texto
    const concentrationRegex = /\b(EDT|EDP|Parfum|Elixir|Intense|Cologne|Eau de Toilette|Eau de Parfum)\b/i;
    const userRequestedConcentration = perfumeName ? perfumeName.match(concentrationRegex)?.[1]?.toUpperCase() : null;

    let searchKey = "";
    let originalSearchKey = "";

    // 1. Si hay texto, intentamos usar el caché primero
    if (perfumeName && !imageBase64) {
      searchKey = perfumeName
        .toLowerCase()
        .trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita tildes
        .replace(/[^a-z0-9]/g, '-'); // Reemplaza espacios y símbolos por guiones

      originalSearchKey = searchKey;

      // 1.5 VERIFICAR ALIAS (ANTI-TYPOS)
      const { data: aliasData } = await supabaseAdmin
        .from('perfume_aliases')
        .select('canonical_key')
        .eq('typo_key', searchKey)
        .single();

      if (aliasData && aliasData.canonical_key) {
        searchKey = aliasData.canonical_key;
      }

      // 2. CONSULTAR EL CACHE (El ahorro de dinero)
      let { data: cachedPerfume } = await supabase
        .from('global_perfume_cache')
        .select('*')
        .eq('search_key', searchKey)
        .single();

      // INTENTO INTELIGENTE: Si no especificó concentración y no lo hallamos, 
      // probamos buscando la versión --edt por defecto
      if (!cachedPerfume && !userRequestedConcentration) {
        const edtKey = `${searchKey}--edt`;
        const { data: fallbackEdt } = await supabase
          .from('global_perfume_cache')
          .select('*')
          .eq('search_key', edtKey)
          .single();
        cachedPerfume = fallbackEdt;
      }

      if (cachedPerfume) {
        // ¡Bingo! Estaba en la base de datos.
        // Cobramos el crédito por usar la plataforma (solo si no es premium)
        if (!isPro) {
          await supabaseAdmin.rpc('decrement_search_credits', { user_id: user.id });
          await supabaseAdmin
            .from('profiles')
            .update({ search_credits: (profile?.search_credits || 1) - 1 })
            .eq('id', user.id);
        }

        return NextResponse.json({
          source: 'cache',
          data: cachedPerfume,
          variants: cachedPerfume.variants ?? []
        });
      }
    }

    // 3. LLAMAR A LA IA (Si no estaba en caché)
    // Usamos una temperatura muy baja (0.1) para evitar "alucinaciones" (que invente notas)

    const isImageSearch = !!imageBase64;
    const userPromptText = perfumeName ? `el perfume solicitado: "${perfumeName}"` : `la imagen adjunta. Identifica qué botella de perfume es (marca y nombre del modelo)`;

    const prompt = `
      Eres el sommelier de fragancias más preciso y minucioso del mundo. Tienes un conocimiento exacto de las pirámides olfativas (salida, corazón, fondo) de todos los perfumes.
      Tu tarea es analizar EXACTAMENTE ${userPromptText}.

      REGLAS ESTRICTAS DE PROCESAMIENTO:
      1. Veracidad: Si la imagen o el texto es incomprensible o definitivamente no es un perfume, devuelve {"found": false}. Si es un perfume real o flanker, DEBES analizarlo y devolver {"found": true}.
      2. Cero Alucinaciones: ¡NO INVENTES NOTAS! Si es un "Flanker" (ej. versión Extreme, Parfum, Intense), asegúrate de dar las notas de ESA versión específica, no las del original.
      3. Concentración: Si el usuario NO especifica la concentración (EDT, EDP, Parfum, etc.), analiza la versión original/más conocida (generalmente EDT). SIEMPRE incluye qué concentración estás analizando en el campo "concentration".
      
      4. EXHAUSTIVIDAD EN VARIANTES (CRÍTICO): Tu objetivo es el 100% de "Recall". Cuando busques variantes o "Flankers" de esta línea, NO te detengas en las 3 o 4 más populares. Realiza una búsqueda profunda en tu base de conocimientos para encontrar versiones de años anteriores, ediciones limitadas (ej: Summer, Absolute, Aqua) o descatalogadas. Prefiero que tomes más tiempo procesando a que omitas un solo Flanker válido.
      
      5. Diferenciación de Género: Si la línea tiene versiones para hombres y mujeres (como "The Icon"), DEBES especificar el género en el nombre de la variante para evitar confusiones (ej: "EDP (Men)", "EDP (Women)"). NO clasifiques versiones femeninas como masculinas ni viceversa. Verifica esto consultando la descripción oficial o el diseño de la botella en tus resultados de búsqueda.
      6. Formato JSON ESTRICTO: Devuelve ÚNICAMENTE un objeto JSON válido. NO uses bloques de código ni markdown (como \`\`\`json). CRÍTICO: Asegúrate de escapar correctamente las comillas dobles internas usando barra invertida (\\") para no romper el formato JSON.
      7. Alternativas: Dentro de ai_metadata, debes proponer 3 alternativas a este perfume:
         - economy: Un clon, inspiración o perfume mucho más barato con un aroma casi idéntico.
         - peer: Un perfume de precio similar de otra marca que comparta la misma vibra.
         - upgrade: Una versión nicho o más lujosa/potente que eleve esta misma experiencia olfativa.

      ESTRUCTURA JSON REQUERIDA (Si el perfume existe):
      {
        "found": true,
        "brand": "Nombre oficial de la casa diseñadora (ej. Issey Miyake)",
        "name": "Nombre completo y correcto del perfume",
        "concentration": "EDT" | "EDP" | "Parfum" | "Elixir" | "Intense" | "Cologne" | "otro",
        "variants": ["EDT (Men)", "EDP (Men)", "EDT (Women)", "EDP (Women)", "Elixir (Men)", "Attitude (Men)", "Splendid (Women)"],
        "description": "Descripción experta de 2-3 líneas. Menciona su familia olfativa (ej. Amaderado Acuático) y qué 'vibra' transmite la persona que lo usa.",
        "top_notes": ["nota", "nota"],
        "heart_notes": ["nota", "nota"],
        "base_notes": ["nota", "nota"],
        "ai_metadata": {
          "clima_ideal": ["calor", "frio", "templado"], 
          "formalidad": ["casual", "semiformal", "formal"], 
          "momento_del_dia": ["manana", "tarde", "noche"], 
          "proyeccion": "suave" | "moderada" | "fuerte",
          "alternatives": {
            "economy": { "brand": "Marca (ej. Armaf)", "name": "Nombre (ej. Club de Nuit)", "reason": "Motivo corto de 1 línea" },
            "peer": { "brand": "Marca", "name": "Nombre", "reason": "Motivo corto de 1 línea" },
            "upgrade": { "brand": "Marca", "name": "Nombre", "reason": "Motivo corto de 1 línea" }
          }
        }
      }
      NOTA PARA ai_metadata: En clima, formalidad y momento, devuelve un arreglo (array) solo con las opciones donde el perfume realmente brille. Puede ser más de una.
    `;

    // Construir el contenido según si hay imagen o solo texto
    const contents: any[] = [{ text: prompt }];
    if (isImageSearch) {
      contents.push({
        inlineData: {
          data: imageBase64,
          mimeType: imageMimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }]
      }
    });

    const responseText = response.text ?? '';

    // Limpiamos la respuesta en caso de que la IA agregue comillas de código Markdown (```json ... ```)
    const cleanJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedData;
    try {
      parsedData = JSON.parse(cleanJsonText);
    } catch (parseError: any) {
      console.error("❌ Error parseando JSON de Gemini. Raw Text:", cleanJsonText);
      throw new Error(`Error de formato al analizar el perfume. La IA devolvió texto inválido. Intenta de nuevo.`);
    }

    // Normalizar las llaves por si Gemini las devuelve en mayúsculas (ej. "Name" en vez de "name")
    const aiData = {
      found: parsedData.found !== undefined ? parsedData.found : parsedData.Found,
      brand: parsedData.brand || parsedData.Brand || parsedData.BRAND,
      name: parsedData.name || parsedData.Name || parsedData.NAME,
      concentration: parsedData.concentration || parsedData.Concentration || 'EDT',
      variants: parsedData.variants || parsedData.Variants || [],
      description: parsedData.description || parsedData.Description,
      top_notes: parsedData.top_notes || parsedData.Top_notes || parsedData.Top_Notes || parsedData.topNotes || [],
      heart_notes: parsedData.heart_notes || parsedData.Heart_notes || parsedData.Heart_Notes || parsedData.heartNotes || [],
      base_notes: parsedData.base_notes || parsedData.Base_notes || parsedData.Base_Notes || parsedData.baseNotes || [],
      ai_metadata: parsedData.ai_metadata || parsedData.Ai_metadata || parsedData.AI_Metadata || parsedData.aiMetadata || {}
    };

    // Si el usuario pidió explícitamente una concentración, forzamos esa (la IA a veces la ignora)
    if (userRequestedConcentration) {
      const normalized = userRequestedConcentration
        .replace(/EAU DE TOILETTE/i, 'EDT')
        .replace(/EAU DE PARFUM/i, 'EDP');
      aiData.concentration = normalized;
    }

    console.log('📋 AI Response:', { name: aiData.name, concentration: aiData.concentration, variants: aiData.variants });

    // VALIDACIÓN: Si la IA dice que no existe o faltan datos vitales
    if (aiData.found === false || !aiData.name || !aiData.brand) {
      console.error("Fallo validación Gemini:", parsedData);
      return NextResponse.json({
        error: 'No pudimos identificar este perfume o la fragancia no existe. Verifica si hay algún error de ortografía.'
      }, { status: 404 });
    }

    // Creamos la clave CANÓNICA basada en lo que la IA dice que es el nombre real + concentración
    const concSuffix = aiData.concentration.toLowerCase().replace(/[^a-z0-9]/g, '');
    const canonicalKey = `${aiData.brand}-${aiData.name}--${concSuffix}`
      .toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, '-');

    // 4.5 GUARDAR ALIAS AUTOMÁTICO (El puente para el caché)
    // Si el usuario buscó "Sauvage EDP" y la clave canónica terminó siendo "dior-sauvage--edp",
    // guardamos que "sauvage-edp" apunta a "dior-sauvage--edp" para que el próximo no gaste IA.
    if (originalSearchKey && originalSearchKey !== canonicalKey) {
      const { error: aliasError } = await supabaseAdmin.from('perfume_aliases').upsert(
        { typo_key: originalSearchKey, canonical_key: canonicalKey },
        { onConflict: 'typo_key' }
      );
      if (aliasError) {
        console.error('⚠️ Error guardando alias automático:', aliasError);
      } else {
        console.log(`🔗 Alias guardado: ${originalSearchKey} -> ${canonicalKey}`);
      }
    }

    // BUSCAMOS OTRA VEZ con la clave canónica
    const { data: canonicalPerfume } = await supabaseAdmin
      .from('global_perfume_cache')
      .select('*')
      .eq('search_key', canonicalKey)
      .single();

    if (canonicalPerfume) {
      // Cobramos el crédito incluso si es un cache hit tardío (solo si no es premium)
      if (!isPro) {
        await supabaseAdmin.rpc('decrement_search_credits', { user_id: user.id });
        await supabaseAdmin
          .from('profiles')
          .update({ search_credits: (profile?.search_credits || 1) - 1 })
          .eq('id', user.id);
      }

      // Si ya existía bajo el nombre oficial, lo devolvemos y listo
      return NextResponse.json({ source: 'canonical_cache', data: canonicalPerfume, variants: canonicalPerfume.variants ?? aiData.variants });
    }

    const imageUrlFromSerper = await fetchPerfumeImageUrl(aiData.brand, aiData.name, aiData.concentration);
    let finalImageUrl: string | null = imageUrlFromSerper;

    if (imageUrlFromSerper) {  // 👈 Antes era: if (aiData.image_url)
      try {
        const imgResponse = await fetch(imageUrlFromSerper, {  // 👈 Usa imageUrlFromSerper
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': new URL(imageUrlFromSerper).origin,
            'Accept': 'image/webp,image/jpeg,image/png,image/*'
          }
        });

        const contentType = imgResponse.headers.get('content-type') || '';

        // ✅ Validar que sea realmente una imagen antes de pasarla a Sharp
        if (imgResponse.ok && contentType.startsWith('image/')) {
          const buffer = Buffer.from(await imgResponse.arrayBuffer());

          const compressedBuffer = await sharp(buffer)
            .resize(400, 400, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toBuffer();

          const fileName = `${canonicalKey}.webp`;

          const { data: uploaded } = await supabaseAdmin.storage
            .from('perfume-images')
            .upload(fileName, compressedBuffer, {
              contentType: 'image/webp',
              upsert: true
            });

          if (uploaded) {
            const { data: publicUrl } = supabaseAdmin.storage
              .from('perfume-images')
              .getPublicUrl(fileName);

            finalImageUrl = publicUrl.publicUrl;
          } else {
            finalImageUrl = null; // Upload falló
          }
        } else {
          // El sitio bloqueó el acceso o no es una imagen
          console.warn(`⚠️ URL bloqueada o no es imagen. Content-Type: ${contentType}`);
          finalImageUrl = null;
        }
      } catch (e) {
        console.warn('⚠️ No se pudo guardar imagen:', e);
        finalImageUrl = null;
      }
    }


    // 4. GUARDAR EN LA BASE DE DATOS (Para futuras búsquedas)
    const newPerfume = {
      search_key: canonicalKey, // USAMOS LA CANÓNICA con concentración
      brand: aiData.brand,
      name: aiData.name,
      concentration: aiData.concentration,
      variants: aiData.variants,   // Guardamos las variantes detectadas por la IA
      description: aiData.description,
      top_notes: aiData.top_notes,
      heart_notes: aiData.heart_notes,
      base_notes: aiData.base_notes,
      ai_metadata: aiData.ai_metadata,
      image_url: finalImageUrl
    };

    const { data: insertedPerfume, error: insertError } = await supabaseAdmin
      .from('global_perfume_cache')
      .insert([newPerfume])
      .select()
      .single();

    if (insertError) {
      console.error('Error guardando en Supabase:', insertError);
      // Aunque falle el guardado, le devolvemos la info al usuario para no interrumpir su experiencia
      return NextResponse.json({ source: 'ai_live', data: newPerfume, variants: aiData.variants });
    }

    // 5. COBRAR EL CRÉDITO (Puesto que fue un éxito, solo si no es premium)
    if (user && !isPro) {
      await supabaseAdmin.rpc('decrement_search_credits', { user_id: user.id });
      await supabaseAdmin
        .from('profiles')
        .update({ search_credits: (profile?.search_credits || 1) - 1 })
        .eq('id', user.id);
    }

    // 6. RESPUESTA FINAL
    return NextResponse.json({
      source: 'ai_live_and_cached',
      data: insertedPerfume,
      variants: aiData.variants
    });

  } catch (error: any) {
    console.error('Error en la API de búsqueda:', error);

    // Si es el error 503 de sobrecarga de Gemini, le damos un mensaje claro
    if (error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('high demand')) {
      return NextResponse.json({
        error: 'Nuestros servidores de IA están temporalmente saturados por alta demanda. Por favor, intenta de nuevo en unos segundos.'
      }, { status: 503 });
    }

    return NextResponse.json({ error: 'Hubo un problema procesando el perfume' }, { status: 500 });
  }
}