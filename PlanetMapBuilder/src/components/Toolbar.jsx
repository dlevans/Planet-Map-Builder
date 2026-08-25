import React from 'react';
import '../styles/Toolbar.css'

function Toolbar({
  selectedTool,
  onSelectTool,
  onDelete,
  onCopy,
  onPaste,
  onSelectAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectedItemCount,
}) {
  const tools = [
    { id: 'select', name: 'Select', icon: '◬', shortcut: 'V' },
    { id: 'lasso', name: 'Lasso', icon: '⟿', shortcut: 'L' },
    { divider: true },
    { id: 'table', name: 'Table', icon: '■', shortcut: 'T' },
    { id: 'chair', name: 'Chair', icon: '●', shortcut: 'C' },
    { id: 'separator', name: 'Separator', icon: '─', shortcut: 'S' },
    { id: 'pipe-and-drape', name: 'Pipe & Drape', icon: '┃', shortcut: 'P' },
    { id: 'signage', name: 'Signage', icon: '▲', shortcut: 'G' },
    { id: 'booth', name: 'Booth', icon: '□', shortcut: 'B' },
    { divider: true },
  ];

  return (
    <aside className="toolbar">
      <div className="toolbar-section">
        <h3 className="toolbar-title">Tools</h3>
        <div className="tool-group">
          {tools.map((tool, idx) => {
            if (tool.divider) {
              return <div key={`divider-${idx}`} className="toolbar-divider" />;
            }
            return (
              <button
                key={tool.id}
                className={`tool-button ${selectedTool === tool.id ? 'active' : ''}`}
                onClick={() => onSelectTool(tool.id)}
                title={`${tool.name} (${tool.shortcut})`}
              >
                <span className="tool-icon">{tool.icon}</span>
                <span className="tool-label">{tool.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <h3 className="toolbar-title">Actions</h3>
        <div className="action-group">
          <button
            className="action-button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            className="action-button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <h3 className="toolbar-title">Edit</h3>
        <div className="action-group">
          <button
            className="action-button"
            onClick={onCopy}
            disabled={selectedItemCount === 0}
            title="Copy (Ctrl+C)"
          >
            ⎘ Copy
          </button>
          <button
            className="action-button"
            onClick={onPaste}
            title="Paste (Ctrl+V)"
          >
            ◐ Paste
          </button>
          <button
            className="action-button"
            onClick={onSelectAll}
            title="Select All (Ctrl+A)"
          >
            □ All
          </button>
          <button
            className="action-button danger"
            onClick={onDelete}
            disabled={selectedItemCount === 0}
            title="Delete (Del)"
          >
            × Delete
          </button>
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section toolbar-info">
        <p className="info-label">Selected</p>
        <p className="info-value">{selectedItemCount} item{selectedItemCount !== 1 ? 's' : ''}</p>
        <p className="info-label" style={{ marginTop: '12px' }}>Tool Shortcuts</p>
        <ul className="shortcuts-list">
          <li>V → Select</li>
          <li>L → Lasso</li>
          <li>T → Table</li>
          <li>C → Chair</li>
          <li>S → Separator</li>
          <li>P → Pipe & Drape</li>
          <li>G → Signage</li>
          <li>B → Booth</li>
        </ul>
        <p className="info-label" style={{ marginTop: '12px' }}>Edit Shortcuts</p>
        <ul className="shortcuts-list">
          <li>Ctrl+Z → Undo</li>
          <li>Ctrl+Y → Redo</li>
          <li>Ctrl+C → Copy</li>
          <li>Ctrl+V → Paste</li>
          <li>Ctrl+A → Select All</li>
          <li>Del → Delete</li>
          <li>Esc → Deselect</li>
        </ul>
      </div>
    </aside>
  );
}

export default Toolbar;