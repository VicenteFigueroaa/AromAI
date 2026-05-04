import { NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const ssrSupabase = await createSSRClient();
    const { data: { user } } = await ssrSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión' }, { status: 401 });
    }

    // Obtener créditos y datos de anuncios actuales
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('search_credits, ads_watched_today, last_ad_date')
      .eq('id', user.id)
      .single();

    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    const lastAdDate = profile?.last_ad_date;
    
    let adsWatched = profile?.ads_watched_today || 0;

    let currentCredits = profile?.search_credits || 0;

    // Reinicio diario
    if (lastAdDate !== today) {
      adsWatched = 0;
      currentCredits = 3; // Si es nuevo día, ya tienes 3 créditos gratis
    }

    // Verificar límite
    if (adsWatched >= 2) {
      return NextResponse.json({ 
        error: 'DAILY_LIMIT_REACHED',
        message: 'Has alcanzado el límite de 2 anuncios por día. Vuelve mañana.'
      }, { status: 403 });
    }

    const newCredits = currentCredits + 1; // Solo +1 por anuncio

    // Actualizar créditos y contadores
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        search_credits: newCredits,
        ads_watched_today: adsWatched + 1,
        last_ad_date: today
      })
      .eq('id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, credits: newCredits });
  } catch (error) {
    console.error('Error al añadir créditos:', error);
    return NextResponse.json({ error: 'Hubo un error al procesar el anuncio' }, { status: 500 });
  }
}
