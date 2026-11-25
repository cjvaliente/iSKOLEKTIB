// iSKOLEKTIB database settings.
// SUPABASE_URL and SUPABASE_ANON_KEY come from Supabase: Project Settings > API.
// The anon key is public by design. It is safe in the browser ONLY because setup.sql turns on
// row-level security. Never put the service_role key in this file.
//
// LOCAL_DEMO_MODE:
//   false = shared cloud mode. Real accounts, password checks, emailed verification codes,
//           and a server-checked admin registration code. Needs custom SMTP (see SMTP-SETUP.md).
//   true  = everything stays in this browser. No emails are sent and NO passwords are checked.
//           Use it only for offline demos with fake data.
window.ISKOLEKTIB_CONFIG = {
  LOCAL_DEMO_MODE: false,
  SUPABASE_URL: 'https://trxlmicgnldjueymvpgu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyeGxtaWNnbmxkanVleW12cGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NDQ1NzUsImV4cCI6MjExMDQyMDU3NX0.R_wItdgpH_ZZh40ZIGe3kVDs0QLPkUFaTPJVKqEL1Bo'
};
