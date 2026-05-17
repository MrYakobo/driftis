import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { MessageSquarePlus, FileText, MessageSquare, CircleCheck, Ellipsis, Sun, Moon, Settings as SettingsIcon } from 'lucide-react'
import IncidentScreen from './pages/IncidentScreen'
import DocsBrowser from './pages/DocsBrowser'
import Settings from './pages/Settings'

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [incidents, setIncidents] = useState([])
  const [menuOpen, setMenuOpen] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const menuRef = useRef(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const [status, setStatus] = useState(null)
  const [settings, setSettings] = useState({ appName: 'Driftassistent', orgName: '' })

  useEffect(() => {
    fetch('/api/docs').then(r => r.json()).then(setDocs)
    fetch('/api/incidents').then(r => r.json()).then(setIncidents)
    const poll = setInterval(() => fetch('/api/status').then(r => r.json()).then(d => { setStatus(d); if (d.settings) setSettings(d.settings) }), 10000)
    fetch('/api/status').then(r => r.json()).then(d => { setStatus(d); if (d.settings) setSettings(d.settings) })
    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function refreshIncidents() {
    fetch('/api/incidents').then(r => r.json()).then(setIncidents)
  }

  async function deleteIncident(id) {
    await fetch(`/api/incident/${id}`, { method: 'DELETE' })
    setMenuOpen(null)
    refreshIncidents()
    if (pathname === `/c/${id}`) navigate('/')
  }

  async function renameIncident(id) {
    if (!renameValue.trim()) return
    await fetch(`/api/incident/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameValue })
    })
    setRenaming(null)
    refreshIncidents()
  }

  async function markIncident(id, status) {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
    setMenuOpen(null)
    refreshIncidents()
  }

  return (
    <div className="flex h-screen bg-white dark:bg-[#1e1e1e] text-gray-800 dark:text-gray-200">
      <aside className="w-64 flex flex-col bg-[#171717] text-gray-200">
        <div className="px-5 py-5 flex items-center justify-between">
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span>
            {settings.appName}
          </h1>
          <button onClick={() => setDark(!dark)} className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer text-gray-400">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
          <button
            onClick={() => navigate('/')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors w-full text-left cursor-pointer ${
              pathname === '/' ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-gray-400'
            }`}
          >
            <MessageSquarePlus size={17} />
            Ny chatt
          </button>

          {incidents.length > 0 && (
            <div className="pt-4 mt-3 border-t border-white/10">
              <p className="px-3 pb-2 text-[11px] uppercase text-gray-500 tracking-wider font-medium">Tidigare</p>
              {incidents.slice().reverse().map(inc => (
                <div key={inc.id} className="relative group">
                  {renaming === inc.id ? (
                    <form onSubmit={e => { e.preventDefault(); renameIncident(inc.id) }} className="flex px-3 py-1.5">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => setRenaming(null)}
                        className="w-full bg-white/10 text-white text-sm rounded px-2 py-1 outline-none"
                      />
                    </form>
                  ) : (
                    <Link
                      to={`/c/${inc.id}`}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                        pathname === `/c/${inc.id}` ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-gray-400'
                      }`}
                    >
                      {inc.status === 'resolved'
                        ? <CircleCheck size={15} className="text-green-400 shrink-0" />
                        : <MessageSquare size={15} className="shrink-0" />
                      }
                      <span className="truncate flex-1">{inc.title || inc.query}</span>
                      <button
                        onClick={e => { e.preventDefault(); setMenuOpen(menuOpen === inc.id ? null : inc.id) }}
                        className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-white/10"
                      >
                        <Ellipsis size={14} />
                      </button>
                    </Link>
                  )}
                  {menuOpen === inc.id && (
                    <div ref={menuRef} className="absolute right-3 top-9 z-50 bg-[#2a2a2a] border border-white/10 rounded-xl shadow-lg py-1 min-w-[140px]">
                      <button onClick={() => { setRenaming(inc.id); setRenameValue(inc.title || inc.query); setMenuOpen(null) }} className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 rounded-lg">Byt namn</button>
                      <div className="border-t border-white/10 my-1" />
                      <p className="px-3 py-1 text-[11px] text-gray-500 uppercase tracking-wide">Markera</p>
                      <button onClick={() => markIncident(inc.id, 'resolved')} className="w-full text-left px-3 py-1.5 text-sm text-green-400 hover:bg-white/10 rounded-lg">Löst</button>
                      <button onClick={() => markIncident(inc.id, 'partial')} className="w-full text-left px-3 py-1.5 text-sm text-yellow-400 hover:bg-white/10 rounded-lg">Delvis</button>
                      <button onClick={() => markIncident(inc.id, 'unresolved')} className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-white/10 rounded-lg">Olöst</button>
                      <div className="border-t border-white/10 my-1" />
                      <button onClick={() => deleteIncident(inc.id)} className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-white/10 rounded-lg">Ta bort</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 mt-3 border-t border-white/10">
            <p className="px-3 pb-2 text-[11px] uppercase text-gray-500 tracking-wider font-medium">Dokumentation</p>
            {docs.map(doc => (
              <Link
                key={doc.id}
                to={`/docs/${doc.id}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                  pathname === `/docs/${doc.id}` ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-gray-400'
                }`}
              >
                <FileText size={15} />
                <span className="truncate">{doc.title}</span>
              </Link>
            ))}
          </div>
        </nav>
        <div className="px-3 py-3 border-t border-white/10">
          <Link
            to="/settings"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
              pathname === '/settings' ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-gray-400'
            }`}
          >
            <SettingsIcon size={15} />
            Inställningar
          </Link>
          {status && <p className="px-3 pt-2 text-[10px] text-gray-600">{Math.round(status.contextUsage)}% ctx</p>}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[#f9f9f9] dark:bg-[#1e1e1e]">
        <div className="max-w-3xl mx-auto px-6 py-6 h-full">
          <Routes>
            <Route path="/" element={<IncidentScreen onNewIncident={refreshIncidents} />} />
            <Route path="/c/:id" element={<IncidentScreen onNewIncident={refreshIncidents} />} />
            <Route path="/docs/:id" element={<DocsBrowser />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
