import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({request});
  if (!url || !key) return response;
  const supabase = createServerClient(url,key,{
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values,headers) {
        values.forEach(({name,value}) => request.cookies.set(name,value));
        response = NextResponse.next({request});
        values.forEach(({name,value,options}) => response.cookies.set(name,value,options));
        Object.entries(headers).forEach(([name,value]) => response.headers.set(name,value));
      },
    },
  });
  // Client construction alone does not validate or refresh a session.
  await supabase.auth.getUser();
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export { updateSession as createClient };
