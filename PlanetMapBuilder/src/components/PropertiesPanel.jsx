import React, { useRef, useEffect } from 'react';
import '../styles/PropertiesPanel.css';

function PropertiesPanel({ selectedItems, onUpdateItem }) {
  const panelRef = useRef(null);

  // Prevent all events from bubbling to canvas
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const preventBubble = (e) => {
      // Don't stop propagation for buttons - let them work
      if (e.target.tagName === 'BUTTON') {
        return;
      }
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    // Capture all events at the panel level
    panel.addEventListener('mousedown', preventBubble, true);
    panel.addEventListener('mouseup', preventBubble, true);
    panel.addEventListener('click', preventBubble, true);
    panel.addEventListener('touchstart', preventBubble, true);
    panel.addEventListener('touchend', preventBubble, true);

    return () => {
      panel.removeEventListener('mousedown', preventBubble, true);
      panel.removeEventListener('mouseup', preventBubble, true);
      panel.removeEventListener('click', preventBubble, true);
      panel.removeEventListener('touchstart', preventBubble, true);
      panel.removeEventListener('touchend', preventBubble, true);
    };
  }, []);

  if (selectedItems.length === 0) {
    return (
      <aside className="properties-panel" ref={panelRef}>
        <div className="properties-empty">
          <p>No items selected</p>
          <p className="hint">Click an item to edit its properties</p>
        </div>
      </aside>
    );
  }

  if (selectedItems.length > 1) {
    return (
      <aside className="properties-panel" ref={panelRef}>
        <div className="properties-empty">
          <p>Multiple items selected</p>
          <p className="hint">{selectedItems.length} items</p>
        </div>
      </aside>
    );
  }

  const item = selectedItems[0];

  const handleChange = (field, value) => {
    if (['x', 'y', 'width', 'height', 'rotation'].includes(field)) {
      if (value === '') {
        onUpdateItem(item.id, { [field]: 0 });
        return;
      }
      const parsed = parseInt(value, 10);
      onUpdateItem(item.id, { [field]: isNaN(parsed) ? 0 : parsed });
    } else {
      onUpdateItem(item.id, { [field]: value });
    }
  };

  const handleInputChange = (field) => (e) => {
    handleChange(field, e.target.value);
  };

  const handleRotate = (degrees) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newRotation = ((item.rotation || 0) + degrees + 360) % 360;
    onUpdateItem(item.id, { rotation: newRotation });
  };

  const handleClearImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onUpdateItem(item.id, { image: null });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      onUpdateItem(item.id, { image: base64 });
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside className="properties-panel" ref={panelRef}>
      <div className="properties-header">
        <h3>Properties</h3>
      </div>

      <div className="properties-content">
        <div className="property-group">
          <label className="property-label">ID</label>
          <input
            type="text"
            className="property-input"
            value={item.id}
            placeholder="Item ID"
            disabled
          />
        </div>

        <div className="property-group">
          <label className="property-label">Label</label>
          <input
            type="text"
            className="property-input"
            value={item.label || ''}
            onChange={handleInputChange('label')}
            placeholder="Display label"
            autoComplete="off"
          />
        </div>

        <div className="property-group">
          <label className="property-label">Type</label>
          <select
            className="property-select"
            value={item.type || ''}
            onChange={handleInputChange('type')}
          >
            <option value="table">Table</option>
            <option value="chair">Chair</option>
            <option value="separator">Separator</option>
            <option value="pipe-and-drape">Pipe & Drape</option>
            <option value="signage">Signage</option>
            <option value="booth">Booth</option>
            <option value="template-image">Template Image</option>
          </select>
        </div>

        {item.type === 'signage' && (
          <div className="property-group">
            <label className="property-label">Signage Image</label>
            <div className="image-preview-container">
              {item.image ? (
                <>
                  <img 
                    src={item.image} 
                    alt="Signage preview" 
                    className="image-preview"
                  />
                  <button 
                    className="clear-image-btn"
                    onClick={handleClearImage}
                  >
                    Clear Image
                  </button>
                </>
              ) : (
                <div className="no-image-placeholder">No image</div>
              )}
            </div>
            <label className="file-input-label">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="file-input"
              />
              <span className="file-input-text">Upload Image</span>
            </label>
          </div>
        )}

        {item.type === 'template-image' && (
          <div className="property-group">
            <label className="property-label">Template Image</label>
            <div className="image-preview-container">
              {item.image ? (
                <>
                  <img 
                    src={item.image} 
                    alt="Template preview" 
                    className="image-preview"
                  />
                  <button 
                    className="clear-image-btn"
                    onClick={handleClearImage}
                  >
                    Clear Image
                  </button>
                </>
              ) : (
                <div className="no-image-placeholder">No image uploaded</div>
              )}
            </div>
            <label className="file-input-label">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="file-input"
              />
              <span className="file-input-text">Upload Image</span>
            </label>
          </div>
        )}

        <div className="properties-divider" />

        <h4 className="properties-subtitle">Position & Size</h4>

        <div className="property-row">
          <div className="property-group">
            <label className="property-label">X</label>
            <input
              type="number"
              className="property-input"
              value={item.x ?? 0}
              onChange={handleInputChange('x')}
            />
          </div>
          <div className="property-group">
            <label className="property-label">Y</label>
            <input
              type="number"
              className="property-input"
              value={item.y ?? 0}
              onChange={handleInputChange('y')}
            />
          </div>
        </div>

        <div className="property-row">
          <div className="property-group">
            <label className="property-label">Width</label>
            <input
              type="number"
              className="property-input"
              value={item.width ?? 80}
              onChange={handleInputChange('width')}
            />
          </div>
          <div className="property-group">
            <label className="property-label">Height</label>
            <input
              type="number"
              className="property-input"
              value={item.height ?? 80}
              onChange={handleInputChange('height')}
            />
          </div>
        </div>

        <div className="properties-divider" />

        <h4 className="properties-subtitle">Rotation</h4>

        <div className="property-row">
          <div className="property-group">
            <label className="property-label">Angle (°)</label>
            <input
              type="number"
              className="property-input"
              value={item.rotation ?? 0}
              onChange={handleInputChange('rotation')}
              min="0"
              max="359"
            />
          </div>
        </div>

        <div className="rotation-controls">
          <button
            className="rotation-btn"
            onClick={handleRotate(-15)}
            title="Rotate -15°"
          >
            ↺ -15°
          </button>
          <button
            className="rotation-btn"
            onClick={handleRotate(15)}
            title="Rotate +15°"
          >
            ↻ +15°
          </button>
        </div>

        <div className="properties-divider" />

        <h4 className="properties-subtitle">Additional Info</h4>

        <div className="property-group">
          <label className="property-label">Notes</label>
          <textarea
            className="property-textarea"
            value={item.notes || ''}
            onChange={handleInputChange('notes')}
            placeholder="Add notes about this item"
            rows="3"
          />
        </div>

        <div className="property-info">
          <p className="info-text">
            <strong>Type:</strong> {item.type}
          </p>
          {item.booths && (
            <p className="info-text">
              <strong>Booths:</strong> {item.booths}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

export default PropertiesPanel;