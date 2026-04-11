import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const BRANCH_COLORS = ['#1a56db', '#7c3aed', '#16a34a', '#d97706', '#dc2626']

export default function DeptManager({ departments, onRefresh, onClose }) {
  const [editNode, setEditNode] = useState(null)
  const [editName, setEditName] = useState('')
  const [addingTo, setAddingTo] = useState(null)
  const [newName, setNewName] = useState('')
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState(false)

  const buildTree = (items, parentId = null) => {
    return items
      .filter(d => d.parent_id === parentId)
      .map(d => ({ ...d, children: buildTree(items, d.id) }))
  }

  const tree = buildTree(departments)

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const handleEdit = async (node) => {
    if (!editName.trim()) return
    setLoading(true)
    await supabase.from('departments').update({ name: editName.trim() }).eq('id', node.id)
    setEditNode(null)
    setEditName('')
    onRefresh()
    setLoading(false)
  }

  const handleAdd = async (parentId) => {
    if (!newName.trim()) return
    setLoading(true)
    await supabase.from('departments').insert([{
      name: newName.trim(),
      parent_id: parentId || null,
      is_active: true,
    }])
    setAddingTo(null)
    setNewName('')
    if (parentId) setExpanded(prev => ({ ...prev, [parentId]: true }))
    onRefresh()
    setLoading(false)
  }

  const handleDelete = async (node) => {
    const hasChildren = departments.some(d => d.parent_id === node.id)
    if (hasChildren) {
      alert('Không thể xóa vì còn bộ phận con bên trong!\nHãy xóa bộ phận con trước.')
      return
    }
    if (!confirm(`Xóa "${node.name}"?\nThao tác này không thể hoàn tác.`)) return
    setLoading(true)
    await supabase.from('departments').update({ is_active: false }).eq('id', node.id)
    onRefresh()
    setLoading(false)
  }

  const getLevelLabel = (level) => {
    if (level === 0) return 'Chi nhánh'
    if (level === 1) return 'Bộ phận'
    return 'Tổ'
  }

  const TreeNode = ({ node, level = 0, colorIndex = 0 }) => {
    const hasChildren = node.children?.length > 0
    const isExpanded = expanded[node.id]
    const isEditing = editNode === node.id
    const isAddingChild = addingTo === node.id
    const color = BRANCH_COLORS[colorIndex % BRANCH_COLORS.length]

    return (
      <div style={{ marginLeft: level * 20 }}>
        <div style={styles.nodeRow}>
          {/* Indent line */}
          {level > 0 && <div style={{ ...styles.indentLine, borderColor: color + '40' }} />}

          {/* Node content */}
          <div style={{ ...styles.nodeCard, borderLeft: `3px solid ${color}` }}>
            <div style={styles.nodeLeft}>
              {/* Toggle */}
              {hasChildren ? (
                <button style={styles.toggleBtn} onClick={() => toggle(node.id)}>
                  {isExpanded ? '▾' : '▸'}
                </button>
              ) : (
                <span style={styles.togglePlaceholder}>·</span>
              )}

              {/* Dot */}
              <div style={{ ...styles.dot, background: color }} />

              {/* Name / Edit input */}
              {isEditing ? (
                <div style={styles.editRow}>
                  <input
                    autoFocus
                    style={styles.editInput}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleEdit(node)
                      if (e.key === 'Escape') { setEditNode(null); setEditName('') }
                    }}
                  />
                  <button style={styles.confirmBtn} onClick={() => handleEdit(node)} disabled={loading}>✓</button>
                  <button style={styles.cancelBtn2} onClick={() => { setEditNode(null); setEditName('') }}>✕</button>
                </div>
              ) : (
                <div style={styles.nameGroup}>
                  <span style={{ ...styles.nodeName, fontWeight: level === 0 ? 700 : level === 1 ? 600 : 400 }}>
                    {node.name}
                  </span>
                  <span style={styles.levelTag}>{getLevelLabel(level)}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {!isEditing && (
              <div style={styles.nodeActions}>
                <button style={styles.actionBtn} title="Sửa tên"
                  onClick={() => { setEditNode(node.id); setEditName(node.name) }}>
                  ✏️
                </button>
                {level < 2 && (
                  <button style={styles.actionBtn} title={`Thêm ${getLevelLabel(level + 1)}`}
                    onClick={() => {
                      setAddingTo(node.id)
                      setNewName('')
                      setExpanded(prev => ({ ...prev, [node.id]: true }))
                    }}>
                    ➕
                  </button>
                )}
                <button style={{ ...styles.actionBtn, color: '#dc2626' }} title="Xóa"
                  onClick={() => handleDelete(node)}>
                  🗑️
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Form thêm con */}
        {isAddingChild && (
          <div style={{ marginLeft: 20, marginTop: 4, marginBottom: 4 }}>
            <div style={styles.addForm}>
              <div style={{ ...styles.dot, background: color, opacity: 0.5 }} />
              <input
                autoFocus
                style={styles.addInput}
                placeholder={`Tên ${getLevelLabel(level + 1)} mới...`}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd(node.id)
                  if (e.key === 'Escape') { setAddingTo(null); setNewName('') }
                }}
              />
              <button style={styles.confirmBtn} onClick={() => handleAdd(node.id)} disabled={loading}>✓</button>
              <button style={styles.cancelBtn2} onClick={() => { setAddingTo(null); setNewName('') }}>✕</button>
            </div>
          </div>
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child, i) => (
              <TreeNode key={child.id} node={child} level={level + 1} colorIndex={colorIndex} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>🏢 Cấu trúc tổ chức</h2>
            <p style={styles.subtitle}>Thêm, sửa, xóa chi nhánh / bộ phận / tổ</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Root: TAV Corp */}
          <div style={styles.rootCard}>
            <span style={styles.rootIcon}>🏢</span>
            <span style={styles.rootName}>TAV Corp</span>
            <button style={styles.actionBtn} title="Thêm chi nhánh"
              onClick={() => { setAddingTo('root'); setNewName('') }}>
              ➕ Thêm chi nhánh
            </button>
          </div>

          {/* Form thêm chi nhánh */}
          {addingTo === 'root' && (
            <div style={{ ...styles.addForm, marginLeft: 0, marginBottom: 12 }}>
              <div style={{ ...styles.dot, background: '#1a56db' }} />
              <input
                autoFocus
                style={styles.addInput}
                placeholder="Tên chi nhánh mới..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd(null)
                  if (e.key === 'Escape') { setAddingTo(null); setNewName('') }
                }}
              />
              <button style={styles.confirmBtn} onClick={() => handleAdd(null)} disabled={loading}>✓</button>
              <button style={styles.cancelBtn2} onClick={() => { setAddingTo(null); setNewName('') }}>✕</button>
            </div>
          )}

          {/* Tree */}
          <div style={styles.tree}>
            {tree.map((node, i) => (
              <TreeNode key={node.id} node={node} level={0} colorIndex={i} />
            ))}
          </div>

          {tree.length === 0 && (
            <p style={styles.empty}>Chưa có chi nhánh nào. Nhấn "➕ Thêm chi nhánh" để bắt đầu.</p>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#fff', borderRadius: 12, width: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid #f3f4f6' },
  title: { fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 4 },
  body: { overflowY: 'auto', padding: '20px 24px', flex: 1 },
  rootCard: { display: 'flex', alignItems: 'center', gap: 10, background: '#1e3a5f', borderRadius: 8, padding: '12px 16px', marginBottom: 16 },
  rootIcon: { fontSize: 18 },
  rootName: { fontSize: 15, fontWeight: 700, color: '#fff', flex: 1 },
  tree: { display: 'flex', flexDirection: 'column', gap: 4 },
  nodeRow: { display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 4 },
  indentLine: { width: 20, borderLeft: '2px dashed #e5e7eb', marginRight: 0, alignSelf: 'stretch', flexShrink: 0 },
  nodeCard: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', borderRadius: 8, padding: '8px 12px', border: '1px solid #f3f4f6' },
  nodeLeft: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 },
  toggleBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6b7280', padding: '0 2px', width: 16, flexShrink: 0 },
  togglePlaceholder: { width: 16, fontSize: 12, color: '#d1d5db', textAlign: 'center', flexShrink: 0 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  nameGroup: { display: 'flex', alignItems: 'center', gap: 8 },
  nodeName: { fontSize: 14, color: '#111827' },
  levelTag: { fontSize: 10, color: '#9ca3af', background: '#f3f4f6', padding: '1px 6px', borderRadius: 10 },
  nodeActions: { display: 'flex', gap: 4, flexShrink: 0 },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4, color: '#6b7280' },
  editRow: { display: 'flex', alignItems: 'center', gap: 6, flex: 1 },
  editInput: { flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #1a56db', fontSize: 13, outline: 'none' },
  addForm: { display: 'flex', alignItems: 'center', gap: 8, background: '#eff6ff', borderRadius: 8, padding: '8px 12px', marginBottom: 4 },
  addInput: { flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 13, outline: 'none', background: '#fff' },
  confirmBtn: { padding: '4px 10px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  cancelBtn2: { padding: '4px 10px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' },
  empty: { textAlign: 'center', color: '#6b7280', fontSize: 14, padding: 24 },
}