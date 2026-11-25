import { createClient } from '@supabase/supabase-js'
import { createApp } from 'vue'
import App from './App.vue'
import { type CrewStore, LocalStore } from './lib/store'
import { SupabaseStore } from './lib/supabaseStore'
import '@fontsource-variable/big-shoulders-display'
import './style.css'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = import.meta.env

// A failed Google redirect comes back as #error=…&error_code=…; show it once and clear the address.
const returned = new URLSearchParams(location.hash.slice(1))
const authError = returned.get('error') ? (returned.get('error_code') ?? returned.get('error_description') ?? 'error') : null
if (authError) history.replaceState(null, '', location.pathname + location.search)

// Without Supabase settings (local dev) crews live in this browser only.
const store: CrewStore =
  url && key
    ? new SupabaseStore(createClient(url, key), location.origin + location.pathname)
    : new LocalStore(localStorage)

createApp(App, { store, authError }).mount('#app')
