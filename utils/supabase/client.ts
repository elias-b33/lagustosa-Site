'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicSupabaseConfig } from './config';

// For future browser-side public/RLS queries. Staff actions use the server API.
export function createClient() {
  const { url, key } = publicSupabaseConfig();
  return createBrowserClient(url, key);
}
