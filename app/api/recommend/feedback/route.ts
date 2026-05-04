import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { log_id, is_positive } = body;

    if (!log_id || typeof is_positive !== 'boolean') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // Actualizar el feedback en la base de datos
    const { error } = await supabase
      .from('recommendation_logs')
      .update({ user_feedback: is_positive })
      .eq('id', log_id)
      .eq('user_id', user.id); // Seguridad extra

    if (error) {
      console.error('Error guardando feedback:', error);
      return NextResponse.json({ error: 'Error en la base de datos' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error general en feedback:', error);
    return NextResponse.json({ error: 'Error procesando solicitud' }, { status: 500 });
  }
}
