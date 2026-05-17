import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Pencil, Save, X, Bold, Italic, Heading2, List, ListOrdered, Undo2, Redo2 } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TurndownService from 'turndown'
import { marked } from 'marked'

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' })

function Toolbar({ editor }) {
  if (!editor) return null
  const btn = (active, onClick, children) => (
    <button onClick={onClick} className={`p-1.5 rounded cursor-pointer ${active ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-200'}`}>{children}</button>
  )
  return (
    <div className="flex gap-0.5 border-b border-gray-200 pb-2 mb-2">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={16} />)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />)}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={16} />)}
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={16} />)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={16} />)}
      <div className="w-px bg-gray-200 mx-1" />
      {btn(false, () => editor.chain().focus().undo().run(), <Undo2 size={16} />)}
      {btn(false, () => editor.chain().focus().redo().run(), <Redo2 size={16} />)}
    </div>
  )
}

export default function DocsBrowser() {
  const { id } = useParams()
  const [content, setContent] = useState('')
  const [editing, setEditing] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Skriv här...' }),
    ],
    editorProps: {
      attributes: { class: 'prose dark:prose-invert max-w-none outline-none min-h-[300px]' },
    },
  })

  useEffect(() => {
    fetch(`/api/doc/${id}`).then(r => r.json()).then(d => setContent(d.content))
    setEditing(false)
  }, [id])

  function startEdit() {
    const html = marked(content)
    editor?.commands.setContent(html)
    setEditing(true)
  }

  async function save() {
    const html = editor.getHTML()
    const md = turndown.turndown(html)
    await fetch(`/api/doc/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: md })
    })
    setContent(md)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-end gap-2 shrink-0">
          <button onClick={save} className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-indigo-500 transition-colors cursor-pointer"><Save size={15} />Spara</button>
          <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-300 transition-colors cursor-pointer"><X size={15} />Avbryt</button>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm mt-3 flex-1 min-h-0 overflow-y-auto">
          <Toolbar editor={editor} />
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex justify-end mb-3">
        <button onClick={startEdit} className="flex items-center gap-1.5 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-300 transition-colors cursor-pointer"><Pencil size={15} />Redigera</button>
      </div>
      <div className="rounded-2xl p-6 prose dark:prose-invert max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
