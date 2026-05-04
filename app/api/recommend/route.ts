import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión' }, { status: 401 });
    }

    // 2. Obtener coordenadas desde el cliente
    const body = await request.json();
    const { latitude, longitude } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'Coordenadas no proporcionadas' }, { status: 400 });
    }

    // 3. Consultar WeatherAPI.com (Server-side para proteger la KEY)
    const weatherKey = process.env.WEATHER_API_KEY;
    if (!weatherKey) {
      return NextResponse.json({ error: 'WEATHER_API_KEY no configurada en el servidor' }, { status: 500 });
    }

    const weatherRes = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${weatherKey}&q=${latitude},${longitude}&lang=es`
    );
    
    if (!weatherRes.ok) {
      throw new Error('Error al consultar WeatherAPI');
    }

    const weatherData = await weatherRes.json();
    const current = weatherData.current;

    // Extraer datos interesantes para la IA
    const weatherContext = {
      temp: current.temp_c,
      feelsLike: current.feelslike_c,
      humidity: current.humidity,
      uv: current.uv,
      condition: current.condition.text,
      isDay: current.is_day === 1 ? 'Día' : 'Noche'
    };

    // 4. Verificar si existe una recomendación reciente (Caché de 2 horas)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: cachedLogs } = await supabase
      .from('recommendation_logs')
      .select(`
        id,
        reasoning,
        weather_context,
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
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (cachedLogs && cachedLogs.length > 0) {
      const cached = cachedLogs[0];
      const p = Array.isArray(cached.perfumes) ? cached.perfumes[0] : cached.perfumes;
      if (p) {
        return NextResponse.json({
          winner: p,
          justification: cached.reasoning,
          context: cached.weather_context,
          source: 'cache',
          log_id: cached.id
        });
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
      .eq('user_id', user.id);

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
      
      CONTEXTO CLIMÁTICO DETALLADO:
      - Temperatura: ${weatherContext.temp}°C (Sensación de ${weatherContext.feelsLike}°C)
      - Condición: ${weatherContext.condition}
      - Humedad: ${weatherContext.humidity}% (Crítico: la humedad alta potencia las notas dulces y puede hacerlas pesadas).
      - Índice UV: ${weatherContext.uv} (Crítico: UV alto sugiere fragancias frescas y energizantes).
      - Momento: ${weatherContext.isDay}
      
      ESTANTE DEL USUARIO:
      ${JSON.stringify(catalog, null, 2)}
      
      INSTRUCCIONES:
      1. Elige UN SOLO perfume del estante que sea el absoluto ganador.
      2. No inventes perfumes.
      3. Tu justificación debe mencionar brevemente por qué encaja con la temperatura, humedad o UV (ej: "Con esta humedad, las notas de ${catalog[0]?.brand || 'madera'} proyectarán mejor sin saturar").
      
      FORMATO DE RESPUESTA REQUERIDO (JSON puro):
      {
        "winner_id": "ID del perfume",
        "justification": "Tu explicación experta (Máximo 3 líneas)."
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });
    const responseText = response.text ?? '';
    const cleanJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiDecision = JSON.parse(cleanJsonText);

    const winnerPerfume = inventoryItems.find((item: any) => {
      const p = Array.isArray(item.perfumes) ? item.perfumes[0] : item.perfumes;
      return String(p.id) === String(aiDecision.winner_id);
    });

    if (!winnerPerfume) {
       return NextResponse.json({ error: 'Error en la selección de IA.' }, { status: 500 });
    }

    const finalWinner = Array.isArray(winnerPerfume.perfumes) ? winnerPerfume.perfumes[0] : winnerPerfume.perfumes;

    // Guardar en caché para futuras consultas
    const { data: insertedLog, error: insertError } = await supabase.from('recommendation_logs').insert([{
      user_id: user.id,
      weather_context: weatherContext,
      recommended_perfume_id: finalWinner.id,
      reasoning: aiDecision.justification
    }]).select('id').single();

    if (insertError) {
      console.error('❌ ERROR GRAVE: No se pudo guardar en recommendation_logs:', insertError);
    } else {
      console.log('✅ Log guardado correctamente con ID:', insertedLog?.id);
    }

    return NextResponse.json({ 
      winner: finalWinner,
      justification: aiDecision.justification,
      context: weatherContext,
      source: 'ai',
      log_id: insertedLog?.id
    });

  } catch (error) {
    console.error('Error en recomendación:', error);
    return NextResponse.json({ error: 'Hubo un problema procesando la recomendación.' }, { status: 500 });
  }
}
