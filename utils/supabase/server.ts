import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicSupabaseConfig } from './config';

export async function createClient(store?: Awaited<ReturnType<typeof cookies>>) {
  const cookieStore = store ?? await cookies();
  const { url, key } = publicSupabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try { values.forEach(({name,value,options}) => cookieStore.set(name,value,options)); }
        catch { /* Read-only Server Component: proxy owns cookie refresh. */ }
      },
    },
  });
}
