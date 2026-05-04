import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Exportamos la instancia para usarla en cualquier parte de la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);