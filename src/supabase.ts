import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Falta la configuració de Supabase al fitxer .env.local')
}

// La sessió del monitor es guarda a sessionStorage: cada pestanya té la
// seva i una pestanya nova torna a demanar el correu i la contrasenya.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: window.sessionStorage },
})
