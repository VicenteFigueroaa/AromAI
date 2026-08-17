import { NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createSSRClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: prompts, error } = await supabase
      .from('user_quick_prompts')
      .select('id, prompt_text, usage_count')
      .eq('user_id', user.id)
      .order('usage_count', { ascending: false })
      .order('last_used_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    return NextResponse.json({ prompts });
  } catch (error: any) {
    console.error('Error fetching quick prompts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
