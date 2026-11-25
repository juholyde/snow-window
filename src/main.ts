import { createClient } from '@supabase/supabase-js'
import { createApp } from 'vue'
import App from './App.vue'
import { type CrewStore, LocalStore } from './lib/store'
import { SupabaseStore } from './lib/supabaseStore'
import '@fontsource-variable/big-shoulders-display'
import './style.css'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = import.meta.env

// Without Supabase settings (local dev) crews live in this browser only.
const store: CrewStore =
  url && key
    ? new SupabaseStore(createClient(url, key), location.origin + location.pathname)
    : new LocalStore(localStorage)

createApp(App, { store }).mount('#app')
