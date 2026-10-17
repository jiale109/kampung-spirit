// The one Supabase client for the whole app. Import it from here, never create another.
// The URL and key come from .env (copy .env.example). Restart `pnpm dev` after changing .env.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env, fill them in and restart pnpm dev.',
  )
}

export const supabase = createClient(url, key)
