import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

// Create exactly one Supabase client for the application.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export default supabase