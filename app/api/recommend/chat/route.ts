import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { createClient as createSSRClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { log_id, message, weatherContext, previousWinnerId, previousJustification } = await request.json();

    if (!log_id || !message) {
      return NextResponse.json({ error: 'Faltan datos obligatorios para el chat.' }, { status: 400 });
    }

    const ssrSupabase = await createSSRClient();
    const { data: { user } } = await ssrSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_pro')
      .eq('id', user.id)
      .single();

    const isPro = profile?.is_pro || false;

    // Validación extra en el servidor para el límite de 150 caracteres para usuarios Freemium
    if (!isPro && message.length > 150) {
      return NextResponse.json({ error: 'Límite de caracteres excedido para usuarios gratis.' }, { status: 403 });
    }

    // Obtener el inventario del usuario para el catálogo
    const { data: inventoryItems, error } = await supabaseAdmin
      .from('inventory')
      .select(`
        perfumes:global_perfume_cache (
          id,
          name,
          brand,
          description,
          top_notes,
          heart_notes,
          base_notes,
          ai_metadata
        )
      `)
      .eq('user_id', user.id);

    if (error || !inventoryItems || inventoryItems.length === 0) {
      return NextResponse.json({ error: 'Tu estante está vacío.' }, { status: 400 });
    }

    const catalog = inventoryItems.map((item: any) => {
      const p = Array.isArray(item.perfumes) ? item.perfumes[0] : item.perfumes;
      return {
        id: p.id,
        brand: p.brand,
        name: p.name,
        notes: [...(p.top_notes || []), ...(p.heart_notes || []), ...(p.base_notes || [])].join(", "),
        recommended_for: p.ai_metadata
      };
    });

    const prompt = `
      Eres un sommelier de fragancias interactivo. Ya hiciste una recomendación previa, pero el usuario te ha dado más contexto a través del chat para que afines o cambies tu decisión.

      CONTEXTO CLIMÁTICO DETALLADO:
      - Temperatura Actual: ${weatherContext?.temp}°C
      - Condición Actual: ${weatherContext?.condition}
      - Precipitación Actual: ${weatherContext?.precip_mm || 0} mm
      - Humedad: ${weatherContext?.humidity}%
      - Índice UV: ${weatherContext?.uv}
      - Momento: ${weatherContext?.isDay}
      
      PRONÓSTICO PARA EL RESTO DEL DÍA (Por Horas):
      ${JSON.stringify(weatherContext?.forecast || [], null, 2)}
      
      ESTANTE DEL USUARIO (Catálogo disponible):
      ${JSON.stringify(catalog, null, 2)}
      
      RECOMENDACIÓN ANTERIOR:
      - Perfume Elegido (ID): ${previousWinnerId}
      - Justificación: "${previousJustification}"
      
      MENSAJE DEL USUARIO (NUEVO CONTEXTO):
      "${message}"
      
      INSTRUCCIONES:
      1. Elige UN SOLO perfume del estante que sea el MEJOR considerando el nuevo mensaje del usuario y el clima. Puede ser el mismo de antes o uno diferente.
      2. No inventes perfumes, solo escoge del catálogo.
      3. Tu justificación debe estar escrita en un tono amigable, respondiéndole directamente al usuario (como si estuvieran conversando) y explicando por qué este perfume encaja perfecto con lo que te acaba de contar. Máximo 4 líneas.
      
      FORMATO DE RESPUESTA REQUERIDO (JSON puro):
      {
        "winner_id": "ID del perfume",
        "justification": "Tu explicación experta en formato conversacional."
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });
    
    const responseText = response.text ?? '';
    const cleanJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    let aiDecision;
    
    try {
      aiDecision = JSON.parse(cleanJsonText);
    } catch (e) {
      console.error("Error parseando respuesta de IA:", cleanJsonText);
      throw new Error('La IA no devolvió un formato válido.');
    }

    const winnerPerfume = inventoryItems.find((item: any) => {
      const p = Array.isArray(item.perfumes) ? item.perfumes[0] : item.perfumes;
      return String(p.id) === String(aiDecision.winner_id);
    });

    const finalWinner = winnerPerfume 
      ? (Array.isArray(winnerPerfume.perfumes) ? winnerPerfume.perfumes[0] : winnerPerfume.perfumes)
      : null;

    if (!finalWinner) {
      throw new Error("El perfume seleccionado por la IA no está en el inventario.");
    }

    // Actualizar el log original en la base de datos para que la caché refleje la nueva decisión
    await supabaseAdmin
      .from('recommendation_logs')
      .update({
        global_perfume_cache_id: finalWinner.id,
        reasoning: aiDecision.justification
      })
      .eq('id', log_id)
      .eq('user_id', user.id); // Seguridad

    return NextResponse.json({
      winner: finalWinner,
      justification: aiDecision.justification
    });

  } catch (error: any) {
    console.error('Error en el chat de recomendación:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
