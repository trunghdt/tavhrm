import { useState } from 'react'

const BRANCH_COLORS = {
  'TAV BN': '#1a56db',
  'TAV NĐ': '#7c3aed',
  'TAV HN': '#16a34a',
}

export default function OrgTree({ departments, selectedId, onSelect }) {
  const [expanded, setExpanded] = useState({ root: true })

  // Build tree từ flat list
  const buildTree = (items, parentId = null) => {
    return items
      .filter(d => d.parent_id === parentId)
      .map(d => ({
        ...d,
        children: buildTree(items, d.id),
      }))
  }

  const tree = buildTree(departments)

  const toggle = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const TreeNode = ({ node, level = 0 }) => {
    const hasChildren = node.children?.length > 0
    const isExpanded = expanded[node.id]
    const isSelected = selectedId === node.id
    const branchColor = BRANCH_COLORS[node.name] || '#1a56db'

    return (
      <div>
        <div
          style={{
            ...styles.node,
            paddingLeft: 12 + level * 16,
            background: isSelected ? '#eff6ff' : 'transparent',
            borderLeft: isSelected ? '3px solid #1a56db' : '3px solid transparent',
          }}
          onClick={() => {
            onSelect(node)
            if (hasChildren) toggle(node.id)
          }}
        >
          <span style={styles.toggleIcon}>
            {hasChildren ? (isExpanded ? '▾' : '▸') : '·'}
          </span>
          {level === 0 && (
            <span style={{ ...styles.branchDot, background: branchColor }} />
          )}
          <span style={{
            ...styles.nodeName,
            fontWeight: level === 0 ? 700 : level === 1 ? 600 : 400,
            color: isSelected ? '#1a56db' : level === 0 ? '#111827' : '#374151',
            fontSize: level === 0 ? 14 : level === 1 ? 13 : 12,
          }}>
            {node.name}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Root node - TAV Corp */}
      <div
        style={{
          ...styles.rootNode,
          background: selectedId === 'root' ? '#eff6ff' : '#1e3a5f',
          color: selectedId === 'root' ? '#1a56db' : '#fff',
          border: selectedId === 'root' ? '2px solid #1a56db' : '2px solid transparent',
        }}
        onClick={() => onSelect({ id: 'root', name: 'TAV Corp' })}
      >
        🏢 TAV Corp
      </div>

      {/* Chi nhánh và phòng ban */}
      <div style={styles.tree}>
        {tree.map(node => (
          <TreeNode key={node.id} node={node} level={0} />
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: { width: '100%' },
  rootNode: {
    padding: '10px 14px', borderRadius: 8, fontWeight: 700, fontSize: 14,
    cursor: 'pointer', marginBottom: 8, textAlign: 'center',
    transition: 'all 0.15s',
  },
  tree: { },
  node: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
    cursor: 'pointer', borderRadius: '0 6px 6px 0', marginBottom: 1,
    transition: 'all 0.1s',
  },
  toggleIcon: { fontSize: 10, color: '#9ca3af', width: 10, flexShrink: 0 },
  branchDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  nodeName: { },
}