import { useState, useEffect } from 'react'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export default function AuthGate({ children }) {
  const [state, setState] = useState('loading') // loading, setup, login, pending, authenticated
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { checkStatus() }, [])

  async function checkStatus() {
    const res = await fetch('/api/auth/status', { headers: { 'x-session': getToken() } })
    const data = await res.json()
    if (data.authenticated) { setState('authenticated'); setUserName(data.name) }
    else if (data.pending) setState('pending')
    else if (data.needsSetup) setState('setup')
    else setState('login')
  }

  function getToken() { return localStorage.getItem('session') || '' }
  const [userName, setUserName] = useState('')

  async function register(isSetup) {
    setError('')
    try {
      const optRes = await fetch('/api/auth/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || (isSetup ? 'Admin' : 'Användare') })
      })
      const { options, userId } = await optRes.json()
      const credential = await startRegistration({ optionsJSON: options })

      const verRes = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, response: credential })
      })
      const result = await verRes.json()

      if (result.verified && result.approved) {
        localStorage.setItem('session', result.token)
        setState('authenticated')
      } else if (result.verified) {
        setState('pending')
      }
    } catch (e) {
      if (e.name === 'NotAllowedError') setError('Begäran avbröts eller nekades. Försök igen.')
      else setError('Registrering misslyckades. Försök igen.')
    }
  }

  async function login() {
    setError('')
    try {
      const optRes = await fetch('/api/auth/login/options', { method: 'POST' })
      const options = await optRes.json()
      const credential = await startAuthentication({ optionsJSON: options })

      const verRes = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: credential })
      })
      const result = await verRes.json()

      if (result.verified) {
        localStorage.setItem('session', result.token)
        setState('authenticated')
      } else {
        setError(result.error || 'Inloggning misslyckades')
      }
    } catch (e) {
      if (e.name === 'NotAllowedError') setError('Begäran avbröts eller nekades. Försök igen.')
      else setError('Inloggning misslyckades. Försök igen.')
    }
  }

  if (state === 'loading') return <div className="flex h-screen items-center justify-center"><p className="text-gray-400">Laddar...</p></div>

  if (state === 'setup') return (
    <div className="flex h-screen items-center justify-center bg-[#f9f9f9] dark:bg-[#1e1e1e]">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-4 h-4 rounded-full bg-indigo-500 mx-auto"></div>
        <h1 className="text-xl font-semibold">Välkommen</h1>
        <p className="text-sm text-gray-500">Skapa ditt admin-konto med en passkey.</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ditt namn" className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl px-4 py-2.5 outline-none" />
        <button onClick={() => register(true)} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-500 transition-colors cursor-pointer">Skapa passkey</button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )

  if (state === 'login') return (
    <div className="flex h-screen items-center justify-center bg-[#f9f9f9] dark:bg-[#1e1e1e]">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-4 h-4 rounded-full bg-indigo-500 mx-auto"></div>
        <h1 className="text-xl font-semibold">Logga in</h1>
        <button onClick={login} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-500 transition-colors cursor-pointer">Logga in med passkey</button>
        <div className="border-t border-gray-200 dark:border-white/10 pt-4">
          <p className="text-sm text-gray-500 mb-2">Ny här?</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ditt namn" className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl px-4 py-2.5 outline-none mb-2" />
          <button onClick={() => register(false)} className="w-full border border-gray-200 dark:border-white/10 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer text-sm">Begär åtkomst</button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )

  if (state === 'pending') return (
    <div className="flex h-screen items-center justify-center bg-[#f9f9f9] dark:bg-[#1e1e1e]">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-4 h-4 rounded-full bg-yellow-500 mx-auto"></div>
        <h1 className="text-xl font-semibold">Väntar på godkännande</h1>
        <p className="text-sm text-gray-500">Din begäran har skickats. En admin behöver godkänna dig.</p>
        <button onClick={checkStatus} className="text-sm text-indigo-600 hover:underline cursor-pointer">Kontrollera igen</button>
      </div>
    </div>
  )

  return children({ userName })
}
