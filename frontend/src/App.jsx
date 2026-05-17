import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { MessageSquarePlus, FileText, MessageSquare, CircleCheck, Ellipsis } from 'lucide-react'
import IncidentScreen from './pages/IncidentScreen'
import DocsBrowser from './pages/DocsBrowser'

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [incidents, setIncidents] = useState([])
  const [menuOpen, setMenuOpen] = useState(null)
  const [renaming, setRenaming] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    fetch('/api/docs').then(r => r.json()).then(setDocs)
    fetch('/api/incidents').then(r => r.json()).then(setIncidents)
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
    <div className="flex h-screen bg-white text-gray-800">
      <aside className="w-64 bg-[#171717] text-gray-200 flex flex-col">
        <div className="px-5 py-5">
          <h1 className="text-base font-semibold text-white">🟣 Driftassistent</h1>
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
        <div className="px-5 py-4 border-t border-white/10 text-xs text-gray-600">
          AI Church Ops
        </div>
      </aside>
      <main className="flex-1 bg-[#f9f9f9]">
        <div className="max-w-3xl mx-auto px-6 py-6 h-full">
          <Routes>
            <Route path="/" element={<IncidentScreen onNewIncident={refreshIncidents} />} />
            <Route path="/c/:id" element={<IncidentScreen onNewIncident={refreshIncidents} />} />
            <Route path="/docs/:id" element={<DocsBrowser />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
