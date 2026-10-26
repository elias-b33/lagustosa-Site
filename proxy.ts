import type { NextRequest } from 'next/server';
import { updateSession } from './utils/supabase/middleware';

// Next 16/Vinext hook. The static Vercel deployment refreshes inside its API.
export const config = { matcher: ['/admin/:path*'] };
export async function proxy(request: NextRequest) {
  return updateSession(request);
}
