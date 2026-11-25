import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

export const supabase = createClient(
  'https://trxlmicgnldjueymvpgu.supabase.co',
  'sb_publishable_E6sT2I6PwFilszhNoRFA6w_B4YNIzIvYOUR-ANON-OR-PUBLISHABLE-KEY'
)