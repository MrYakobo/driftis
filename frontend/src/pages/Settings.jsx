import { useState, useEffect } from 'react'

export default function Settings() {
  const [settings, setSettings] = useState({ appName: '', orgName: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings)
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

  return (
    <div className="max-w-md space-y-6 pt-8">
      <h1 className="text-xl font-semibold">Inställningar</h1>
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
  )
}
