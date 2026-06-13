import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Variáveis de ambiente do Supabase não configuradas. ' +
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (local) ' +
    'ou nas variáveis de ambiente do Vercel (produção).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
