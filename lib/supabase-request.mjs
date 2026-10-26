import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';

// One client per request. Keep refresh tokens out of browser JavaScript/storage.
export function createRequestAuth(request, env, fetchImpl = fetch) {
  const pending = new Map();
  const jar = new Map(parseCookieHeader(request.headers.get('cookie') || '').map(x=>[x.name,x.value ?? '']));
  const cacheHeaders = {};
  const client = createServerClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{
    global:{fetch:fetchImpl},
    cookieOptions:{httpOnly:true,secure:true,sameSite:'strict',path:'/'},
    cookies:{
      getAll:()=>[...jar].map(([name,value])=>({name,value})),
      setAll(values,headers){
        Object.assign(cacheHeaders,headers);
        for(const value of values){jar.set(value.name,value.value);pending.set(value.name,value);}
      },
    },
  });
  return {client,finish(response){
    for(const [name,value] of Object.entries(cacheHeaders))response.headers.set(name,value);
    for(const {name,value,options} of pending.values()) response.headers.append('Set-Cookie',serializeCookieHeader(name,value,options));
    return response;
  }};
}
