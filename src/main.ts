import { createClient } from '@supabase/supabase-js'
import { createApp } from 'vue'
import App from './App.vue'
import { type BoardStore, LocalStore } from './lib/store'
import { SupabaseStore } from './lib/supabaseStore'
import './style.css'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = import.meta.env

// Without Supabase settings (local dev) the board lives in this browser only.
const store: BoardStore =
  url && key
    ? new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }))
    : new LocalStore(localStorage)

createApp(App, { store }).mount('#app')
