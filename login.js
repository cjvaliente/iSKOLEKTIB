import { supabase } from './supabase.js'

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://cjvaliente.github.io/MGT_Scholarship/'
    }
  })
  if (error) console.error(error)
}

document.getElementById('google-login-btn')
  ?.addEventListener('click', signInWithGoogle)

// Shows who is logged in (useful for testing)
supabase.auth.onAuthStateChange((event, session) => {
  if (session) console.log('Logged in as:', session.user.email)
})