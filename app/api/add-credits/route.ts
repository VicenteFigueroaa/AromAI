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
      .select('search_credits, ads_watched_today')
      .eq('id', user.id)
      .single();

    const adsWatched = profile?.ads_watched_today || 0;
    const currentCredits = profile?.search_credits || 0;

    // Verificar límite diario de anuncios
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
        last_ad_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, credits: newCredits });
  } catch (error) {
    console.error('Error al añadir créditos:', error);
    return NextResponse.json({ error: 'Hubo un error al procesar el anuncio' }, { status: 500 });
  }
}
