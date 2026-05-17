import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'

const suggestions = [
  'Projektorn är svart',
  'Inget ljud från pastorns mikrofon',
  'Streamen startar inte',
  'Fel scene i mixern',
]

export default function IncidentScreen({ onNewIncident }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [incidentId, setIncidentId] = useState(null)
  const [feedbackGiven, setFeedbackGiven] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (id) {
      fetch(`/api/incident/${id}`).then(r => r.json()).then(data => {
        if (data.query) {
          const msgs = [
            { role: 'user', text: data.query },
            { role: 'assistant', text: data.response }
          ]
          if (data.messages) {
            for (const m of data.messages) {
              msgs.push({ role: m.role, text: m.content })
            }
          }
          setMessages(msgs)
          setIncidentId(data.id)
          setFeedbackGiven(data.status !== 'pending')
        }
      })
    } else {
      setMessages([])
      setIncidentId(null)
      setFeedbackGiven(false)
    }
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function submit(text) {
    const q = text || query
    if (!q.trim() || loading) return
    setQuery('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)

    if (!incidentId) {
      const res = await fetch('/api/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      })
      await handleStream(res, (meta) => {
        setIncidentId(meta.id)
        onNewIncident?.()
        navigate(`/c/${meta.id}`, { replace: true })
      })
    } else {
      const res = await fetch(`/api/incident/${incidentId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q })
      })
      await handleStream(res)
    }
    setLoading(false)
  }

  async function handleStream(res, onMeta) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let sources = null
    let msgIndex = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))

        if (data.type === 'meta') {
          sources = data.matchedDocs
          if (onMeta) onMeta(data)
        } else if (data.type === 'chunk') {
          setMessages(prev => {
            const msgs = [...prev]
            if (msgIndex === null || msgs[msgs.length - 1]?.role !== 'assistant') {
              msgIndex = msgs.length
              msgs.push({ role: 'assistant', text: data.text, sources })
            } else {
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], text: msgs[msgs.length - 1].text + data.text }
            }
            return msgs
          })
          if (msgIndex === null) msgIndex = 0
        }
      }
    }
  }

  async function handleFeedback(status) {
    setFeedbackGiven(true)
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: incidentId, status })
    })
    onNewIncident?.()
  }

  const hasAssistantMsg = messages.some(m => m.role === 'assistant')

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <h1 className="text-3xl font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Vad krånglar just nu?</h1>
          <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="border border-gray-200 rounded-2xl px-4 py-4 text-sm text-left text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); submit() }} className="relative w-full max-w-lg">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Beskriv problemet..."
              className="w-full bg-gray-100 rounded-2xl px-5 py-4 pr-14 outline-none focus:ring-2 focus:ring-indigo-200 border-none"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-500 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' && (
                  <div className="flex justify-end">
                    <div className="bg-indigo-50 rounded-2xl px-5 py-3.5 max-w-md">
                      <p className="text-gray-700">{msg.text}</p>
                    </div>
                  </div>
                )}
                {msg.role === 'assistant' && (
                  <div className="rounded-2xl p-5 prose max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                    {msg.sources?.length > 0 && (
                      <div className="not-prose mt-4 pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">Källor:</span>
                        {msg.sources.map(s => (
                          <a key={s.id} href={`/docs/${s.id}`} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                            {s.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && <p className="text-gray-400 animate-pulse">Tänker...</p>}

            <div ref={bottomRef} />
          </div>
          <div className="pt-3 pb-2">
            <form onSubmit={e => { e.preventDefault(); submit() }} className="relative">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Skriv ett meddelande..."
                className="w-full bg-gray-100 rounded-2xl px-5 py-4 pr-14 outline-none focus:ring-2 focus:ring-indigo-200 border-none"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
