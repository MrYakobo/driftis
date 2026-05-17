import { useState, useEffect } from 'react'
import { Check, X, UserX } from 'lucide-react'

export default function Settings() {
  const [settings, setSettings] = useState({ appName: '', orgName: '' })
  const [saved, setSaved] = useState(false)
  const [requests, setRequests] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings)
    fetch('/api/auth/requests').then(r => r.json()).then(setRequests)
    fetch('/api/auth/users').then(r => r.json()).then(setUsers)
  }, [])

  async function save(e) {
    e.preventDefault()
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function approve(userId) {
    await fetch('/api/auth/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })
    setRequests(requests.filter(r => r.id !== userId))
    fetch('/api/auth/users').then(r => r.json()).then(setUsers)
  }

  async function reject(userId) {
    await fetch('/api/auth/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })
    setRequests(requests.filter(r => r.id !== userId))
  }

  async function revoke(userId) {
    await fetch('/api/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })
    setUsers(users.filter(u => u.id !== userId))
  }

  return (
    <div className="max-w-md space-y-8 pt-8">
      <div>
        <h1 className="text-xl font-semibold mb-4">Inställningar</h1>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Appnamn</label>
            <input
              value={settings.appName}
              onChange={e => setSettings({ ...settings, appName: e.target.value })}
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Organisationsnamn</label>
            <input
              value={settings.orgName}
              onChange={e => setSettings({ ...settings, orgName: e.target.value })}
              className="w-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-500 transition-colors cursor-pointer">
            Spara
          </button>
          {saved && <span className="text-sm text-green-600 ml-3">✓ Sparat</span>}
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Åtkomstförfrågningar</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-500">Inga väntande förfrågningar.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map(r => (
              <li key={r.id} className="flex items-center justify-between bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString('sv-SE')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(r.id)} className="p-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 cursor-pointer"><Check size={16} /></button>
                  <button onClick={() => reject(r.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 cursor-pointer"><X size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Godkända användare</h2>
        <ul className="space-y-2">
          {users.map(u => (
            <li key={u.id} className="flex items-center justify-between bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3">
              <div>
                <p className="font-medium text-sm">{u.name} {u.admin && <span className="text-xs text-indigo-500 ml-1">admin</span>}</p>
                <p className="text-xs text-gray-500">{new Date(u.createdAt).toLocaleString('sv-SE')}</p>
              </div>
              {!u.admin && (
                <button onClick={() => revoke(u.id)} className="p-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 cursor-pointer" title="Ta bort åtkomst">
                  <UserX size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
