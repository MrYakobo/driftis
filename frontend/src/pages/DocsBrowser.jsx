import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Pencil, Save, X, Bold, Italic, Heading2, List, ListOrdered } from 'lucide-react'

export default function DocsBrowser() {
  const { id } = useParams()
  const [content, setContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    fetch(`/api/doc/${id}`).then(r => r.json()).then(d => setContent(d.content))
    setEditing(false)
  }, [id])

  function startEdit() {
    setDraft(content)
    setEditing(true)
  }

  async function save() {
    await fetch(`/api/doc/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: draft })
    })
    setContent(draft)
    setEditing(false)
  }

  function insert(before, after = '') {
    const ta = document.getElementById('md-editor')
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = draft.slice(start, end)
    const newText = draft.slice(0, start) + before + selected + after + draft.slice(end)
    setDraft(newText)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + before.length
      ta.selectionEnd = start + before.length + selected.length
    }, 0)
  }

  if (editing) {
    return (
      <div className="flex flex-col h-full gap-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button onClick={() => insert('**', '**')} className="p-1.5 rounded hover:bg-gray-200" title="Fet"><Bold size={16} /></button>
            <button onClick={() => insert('*', '*')} className="p-1.5 rounded hover:bg-gray-200" title="Kursiv"><Italic size={16} /></button>
            <button onClick={() => insert('## ')} className="p-1.5 rounded hover:bg-gray-200" title="Rubrik"><Heading2 size={16} /></button>
            <button onClick={() => insert('- ')} className="p-1.5 rounded hover:bg-gray-200" title="Lista"><List size={16} /></button>
            <button onClick={() => insert('1. ')} className="p-1.5 rounded hover:bg-gray-200" title="Numrerad lista"><ListOrdered size={16} /></button>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-indigo-500 transition-colors"><Save size={15} />Spara</button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-300 transition-colors"><X size={15} />Avbryt</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          <textarea
            id="md-editor"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full h-full bg-gray-50 rounded-xl p-4 font-mono text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <div className="overflow-y-auto bg-white rounded-xl p-4 prose max-w-none">
            <ReactMarkdown>{draft}</ReactMarkdown>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={startEdit} className="flex items-center gap-1.5 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-300 transition-colors cursor-pointer"><Pencil size={15} />Redigera</button>
      </div>
      <div className="rounded-2xl p-6 prose max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
