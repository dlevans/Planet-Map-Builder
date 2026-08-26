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
  toolLabel,
  onToolLabelChange,
}) {
  const tools = [
    { id: 'select', name: selectedItemCount > 0 ? 'Move' : 'Select', icon: '◬' },
    { id: 'lasso', name: 'Lasso', icon: '⟿' },
    { divider: true },
    { id: 'table', name: 'Table', icon: '■' },
    { id: 'chair', name: 'Chair', icon: '●' },
    { id: 'separator', name: 'Separator', icon: '─' },
    { id: 'pipe-and-drape', name: 'Pipe & Drape', icon: '┃' },
    { id: 'signage', name: 'Signage', icon: '▲' },
    { id: 'booth', name: 'Booth', icon: '□' },
    { divider: true },
  ];

  return (
    <aside className="toolbar">
      <div className="toolbar-section">
        <h3 className="toolbar-title">Label</h3>
        <div className="label-input-group">
          <input
            type="text"
            className="label-input"
            value={toolLabel}
            onChange={(e) => onToolLabelChange(e.target.value)}
            placeholder="Enter booth label"
          />
        </div>
      </div>

      <div className="toolbar-divider" />

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
                title={tool.name}
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
            title="Undo"
          >
            ↶ Undo
          </button>
          <button
            className="action-button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
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
            title="Copy"
          >
            ⎘ Copy
          </button>
          <button
            className="action-button"
            onClick={onPaste}
            title="Paste"
          >
            ◐ Paste
          </button>
          <button
            className="action-button"
            onClick={onSelectAll}
            title="Select All"
          >
            □ All
          </button>
          <button
            className="action-button danger"
            onClick={onDelete}
            disabled={selectedItemCount === 0}
            title="Delete"
          >
            × Delete
          </button>
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section toolbar-info">
        <p className="info-label">Selected</p>
        <p className="info-value">{selectedItemCount} item{selectedItemCount !== 1 ? 's' : ''}</p>
      </div>
    </aside>
  );
}

export default Toolbar;