import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function fetchWeatherWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      
      // Si es un error del cliente (4xx), no reintentamos
      if (res.status >= 400 && res.status < 500) {
        const errBody = await res.text();
        throw new Error(`WeatherAPI error ${res.status}: ${errBody}`);
      }

      // Error de servidor (5xx) → reintentamos
      console.warn(`⚠️ WeatherAPI intento ${attempt}/${maxRetries} falló con status ${res.status}`);
    } catch (err: any) {
      if (err.message.startsWith('WeatherAPI error 4')) throw err; // No reintentar 4xx
      console.warn(`⚠️ WeatherAPI intento ${attempt}/${maxRetries} excepción:`, err.message);
      if (attempt === maxRetries) throw err;
    }
    // Esperar antes de reintentar (backoff exponencial: 500ms, 1s, 2s)
    await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
  }
  throw new Error('WeatherAPI: agotados todos los reintentos');
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión' }, { status: 401 });
    }

    // 2. Obtener datos desde el cliente
    const { latitude, longitude, city, preContextMessage } = await request.json();

    let queryParam = "";
    if (latitude && longitude) {
      queryParam = `${latitude},${longitude}`;
    } else if (city && typeof city === 'string' && city.trim().length > 0) {
      queryParam = encodeURIComponent(city.trim());
    } else {
      return NextResponse.json({ error: 'Coordenadas o ciudad no proporcionada' }, { status: 400 });
    }

    // 3. Consultar WeatherAPI.com con reintentos automáticos
    const weatherKey = process.env.WEATHER_API_KEY;
    if (!weatherKey) {
      return NextResponse.json({ error: 'WEATHER_API_KEY no configurada en el servidor' }, { status: 500 });
    }

    const weatherUrl = `https://api.weatherapi.com/v1/forecast.json?key=${weatherKey}&q=${queryParam}&days=1&lang=es`;
    
    let weatherRes: Response;
    try {
      weatherRes = await fetchWeatherWithRetry(weatherUrl);
    } catch (weatherErr: any) {
      console.error('❌ WeatherAPI falló tras reintentos:', weatherErr.message);
      return NextResponse.json({ 
        error: `No pudimos obtener el clima para "${city || 'las coordenadas indicadas'}". Verifica el nombre de la ciudad e intenta de nuevo.` 
      }, { status: 502 });
    }

    const weatherData = await weatherRes.json();
    const current = weatherData.current;
    const location = weatherData.location;

    const hourlyForecast = weatherData.forecast?.forecastday?.[0]?.hour?.map((h: any) => ({
      time: h.time.split(' ')[1],
      temp: h.temp_c,
      condition: h.condition.text,
      chance_of_rain: h.chance_of_rain
    })) || [];

    const precip = current.precip_mm || 0;
    let finalCondition = current.condition.text;

    // Filtro de Realidad: Si la API dice que llueve pero la precipitación es casi nula (menor a 0.1mm), forzamos que sea "Nublado"
    if (finalCondition.toLowerCase().includes('lluvia') && precip < 0.1) {
      finalCondition = 'Nublado';
    }

    // Extraer datos interesantes para la IA
    const weatherContext = {
      locationName: location?.name || 'Desconocida',
      locationCountry: location?.country || 'Desconocido',
      temp: current.temp_c,
      feelsLike: current.feelslike_c,
      humidity: current.humidity,
      uv: current.uv,
      condition: finalCondition,
      precip_mm: precip,
      isDay: current.is_day === 1 ? 'Día' : 'Noche',
      forecast: hourlyForecast
    };

    // 4. Verificar si existe una recomendación reciente (Caché de 2 horas)
    // Solo usamos caché si el usuario NO ha enviado un contexto especial pre-recomendación
    if (!preContextMessage) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: cachedLogs } = await supabase
        .from('recommendation_logs')
        .select(`
          id,
          reasoning,
          weather_context,
          winner_percentage,
          alternative_reasoning,
          alternative_percentage,
          perfumes:global_perfume_cache!recommendation_logs_recommended_perfume_id_fkey (
            id,
            name,
            brand,
            description,
            top_notes,
            heart_notes,
            base_notes,
            ai_metadata,
            image_url
          ),
          alternative_perfumes:global_perfume_cache!recommendation_logs_alternative_perfume_id_fkey (
            id,
            name,
            brand,
            description,
            top_notes,
            heart_notes,
            base_notes,
            ai_metadata,
            image_url
          )
        `)
        .eq('user_id', user.id)
        .gte('created_at', twoHoursAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (cachedLogs && cachedLogs.length > 0) {
        const cached = cachedLogs[0] as any;
        const p = Array.isArray(cached.perfumes) ? cached.perfumes[0] : cached.perfumes;
        const alt = Array.isArray(cached.alternative_perfumes) ? cached.alternative_perfumes[0] : cached.alternative_perfumes;
        
        if (p) {
          return NextResponse.json({
            winner: p,
            winner_percentage: cached.winner_percentage || 100,
            justification: cached.reasoning,
            alternative: alt ? {
              perfume: alt,
              justification: cached.alternative_reasoning,
              percentage: cached.alternative_percentage
            } : null,
            context: cached.weather_context,
            source: 'cache',
            log_id: cached.id
          });
        }
      }
    }

    // 5. Obtener el inventario del usuario (si no hay caché)
    const { data: inventoryItems, error } = await supabase
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
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error || !inventoryItems || inventoryItems.length === 0) {
      return NextResponse.json({ error: 'Tu estante está vacío. Añade perfumes primero.' }, { status: 400 });
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

    // 5. Llamar a Gemini con el contexto enriquecido

    const prompt = `
      Eres un sommelier de fragancias maestro. Tu trabajo es elegir el MEJOR perfume para el usuario en este momento exacto.
      
      ${preContextMessage ? `PETICIÓN ESPECIAL DEL USUARIO PARA HOY:\n"${preContextMessage}"\n(Debes priorizar esta petición por encima de cualquier otra regla de clima si aplica).` : ''}

      CONTEXTO CLIMÁTICO DETALLADO (AHORA):
      - Temperatura: ${weatherContext.temp}°C (Sensación de ${weatherContext.feelsLike}°C)
      - Condición: ${weatherContext.condition} 
      - Precipitación Actual: ${weatherContext.precip_mm} mm
      - Humedad: ${weatherContext.humidity}% (Crítico: la humedad alta potencia las notas dulces y puede hacerlas pesadas).
      - Índice UV: ${weatherContext.uv} (Crítico: UV alto sugiere fragancias frescas y energizantes).
      - Momento: ${weatherContext.isDay}

      PRONÓSTICO PARA EL RESTO DEL DÍA (Por Horas):
      ${JSON.stringify(weatherContext.forecast, null, 2)}
      
      ESTANTE DEL USUARIO:
      ${JSON.stringify(catalog, null, 2)}
      
      INSTRUCCIONES:
      1. Elige UN perfume del estante que sea el absoluto GANADOR ("winner_id").
      2. Si el usuario tiene más de un perfume en su estante, elige también un segundo perfume como ALTERNATIVA ("alternative_id") diferente al ganador, junto con una pequeña justificación. Si solo tiene 1 perfume, usa null para alternative_id y alternative_justification.
      3. Asigna un porcentaje de confianza (0 a 100) a cada uno ("winner_percentage" y "alternative_percentage"), representando qué tan perfectos son para la ocasión. La suma de ambos DEBE ser 100.
      ¡IMPORTANTE!: Calcula estos valores de manera OBJETIVA Y REAL basándote en la idoneidad del clima y perfil, NO uses valores por defecto (ej: puede ser 95 y 5, 51 y 49, 82 y 18, etc.). Si solo hay un perfume, el ganador es 100 y la alternativa null.
      4. No inventes perfumes.
      5. Tus justificaciones deben mencionar brevemente por qué encajan con la temperatura, humedad, UV o petición especial (máximo 3 líneas cada una).
      
      FORMATO DE RESPUESTA REQUERIDO (JSON puro):
      {
        "winner_id": "ID del perfume principal",
        "justification": "Tu explicación experta para el ganador principal (Máximo 3 líneas).",
        "winner_percentage": <número entero calculado objetivamente>,
        "alternative_id": "ID del perfume alternativo o null",
        "alternative_justification": "Tu explicación para la opción alternativa (Máximo 2 líneas) o null",
        "alternative_percentage": <número entero calculado objetivamente>
      }
    `;

    let aiDecision: any;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
      });
      const responseText = response.text ?? '';
      const cleanJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      aiDecision = JSON.parse(cleanJsonText);
    } catch (aiErr: any) {
      console.error('❌ Error en Gemini:', aiErr.message);
      return NextResponse.json({ 
        error: 'La IA no pudo procesar tu recomendación. Intenta de nuevo en unos segundos.' 
      }, { status: 503 });
    }

    const winnerPerfume = inventoryItems.find((item: any) => {
      const p = Array.isArray(item.perfumes) ? item.perfumes[0] : item.perfumes;
      return String(p.id) === String(aiDecision.winner_id);
    });

    if (!winnerPerfume) {
       return NextResponse.json({ error: 'Error en la selección de IA.' }, { status: 500 });
    }

    const finalWinner = Array.isArray(winnerPerfume.perfumes) ? winnerPerfume.perfumes[0] : winnerPerfume.perfumes;

    let finalAlternative = null;
    if (aiDecision.alternative_id) {
      const altItem = inventoryItems.find((item: any) => {
        const p = Array.isArray(item.perfumes) ? item.perfumes[0] : item.perfumes;
        return String(p.id) === String(aiDecision.alternative_id);
      });
      if (altItem) {
        const p = Array.isArray(altItem.perfumes) ? altItem.perfumes[0] : altItem.perfumes;
        finalAlternative = {
          perfume: p,
          justification: aiDecision.alternative_justification || 'Excelente segunda opción para el clima actual.',
          percentage: aiDecision.alternative_percentage || 0
        };
      }
    }

    // Guardar en caché para futuras consultas
    const { data: insertedLog, error: insertError } = await supabase.from('recommendation_logs').insert([{
      user_id: user.id,
      weather_context: weatherContext,
      recommended_perfume_id: finalWinner.id,
      reasoning: aiDecision.justification,
      winner_percentage: aiDecision.winner_percentage || 100,
      alternative_perfume_id: finalAlternative ? finalAlternative.perfume.id : null,
      alternative_reasoning: finalAlternative ? finalAlternative.justification : null,
      alternative_percentage: finalAlternative ? finalAlternative.percentage : null
    }]).select('id').single();

    if (insertError) {
      console.error('❌ ERROR GRAVE: No se pudo guardar en recommendation_logs:', insertError);
    } else {
      console.log('✅ Log guardado correctamente con ID:', insertedLog?.id);
    }

    // Guardar Quick Prompt si el usuario escribió uno
    if (preContextMessage && preContextMessage.trim().length > 0) {
      const promptText = preContextMessage.trim();
      const { data: existingPrompt } = await supabase
        .from('user_quick_prompts')
        .select('id, usage_count')
        .eq('user_id', user.id)
        .eq('prompt_text', promptText)
        .single();

      if (existingPrompt) {
        await supabase
          .from('user_quick_prompts')
          .update({ 
            usage_count: existingPrompt.usage_count + 1, 
            last_used_at: new Date().toISOString() 
          })
          .eq('id', existingPrompt.id);
      } else {
        await supabase
          .from('user_quick_prompts')
          .insert({ 
            user_id: user.id, 
            prompt_text: promptText 
          });
      }
    }

    return NextResponse.json({ 
      winner: finalWinner,
      winner_percentage: aiDecision.winner_percentage || 100,
      justification: aiDecision.justification,
      alternative: finalAlternative,
      context: weatherContext,
      source: 'ai',
      log_id: insertedLog?.id
    });

  } catch (error: any) {
    console.error('❌ Error en recomendación:', error?.message || error);
    return NextResponse.json({ error: 'Hubo un problema procesando la recomendación.' }, { status: 500 });
  }
}
