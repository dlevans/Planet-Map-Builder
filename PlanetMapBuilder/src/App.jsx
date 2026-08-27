import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import RoomSelector from './components/RoomSelector';
import PropertiesPanel from './components/PropertiesPanel';
import sampleData from './data/booths.json';

// Pre-made templates
const TEMPLATES = {
  'round-table-10': {
    name: 'Round Table + 10 Chairs',
    isImage: true,
    width: 35,
    height: 35,
    image: '/images/template_images/10chair1table.png',
  },
};

// Booth category to color mapping
const BOOTH_COLORS = {
  'celebrity': '#ef4444',  // Red
  'vendor': '#22c55e',     // Green
  'guest': '#3b82f6',      // Blue
  'other': '#6b7280',      // Gray
};

// Grid snap size
const GRID_SIZE = 5;

function App() {
  // Helper functions for localStorage - manage all rooms
  const saveAllRoomsToLocalStorage = (allRooms) => {
    localStorage.setItem('all-rooms-data', JSON.stringify(allRooms));
  };

  const loadAllRoomsFromLocalStorage = () => {
    const saved = localStorage.getItem('all-rooms-data');
    return saved ? JSON.parse(saved) : null;
  };

  // Initialize with saved data or sample data
  const [rooms, setRooms] = useState(() => {
    const saved = loadAllRoomsFromLocalStorage();
    if (saved) {
      return saved;
    }
    return sampleData.rooms;
  });

  const [selectedRoom, setSelectedRoom] = useState('hall-d');
  const [items, setItems] = useState(rooms['hall-d']?.booths || []);
  const [selectedTool, setSelectedTool] = useState('select');
  const [selectedItems, setSelectedItems] = useState([]);
  const [clipboard, setClipboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [roomsOpen, setRoomsOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [pendingToolOrientation, setPendingToolOrientation] = useState(null);
  const [pendingBoothCategory, setPendingBoothCategory] = useState(null);
  const [toolLabel, setToolLabel] = useState('');
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Save current room's items to rooms state and localStorage
  useEffect(() => {
    const updatedRooms = {
      ...rooms,
      [selectedRoom]: {
        ...rooms[selectedRoom],
        booths: items
      }
    };
    setRooms(updatedRooms);
    saveAllRoomsToLocalStorage(updatedRooms);
  }, [items]);

  // Load items when room changes
  useEffect(() => {
    const roomItems = rooms[selectedRoom]?.booths || [];
    setItems(roomItems);
    setSelectedItems([]);
    setHistory([{ items: roomItems }]);
    setHistoryIndex(0);
  }, [selectedRoom, rooms]);

  // Handle tool selection with menu for certain tools
  const handleSelectTool = useCallback((toolId) => {
    if (toolId === 'pipe-and-drape' || toolId === 'separator' || toolId === 'table' || toolId === 'booth') {
      setActiveMenu(toolId);
      setIsMenuOpen(true);
      setPendingToolOrientation(null);
      // Reset booth category when selecting booth tool
      if (toolId === 'booth') {
        setPendingBoothCategory(null);
      }
    } else {
      setSelectedTool(toolId);
      setIsMenuOpen(false);
      setPendingToolOrientation(null);
    }
  }, []);

  // Handle tool menu selection
  const handleToolMenuSelect = useCallback((orientation) => {
    // For booth, first selection is category, second is size
    if (activeMenu === 'booth' && !pendingBoothCategory) {
      setPendingBoothCategory(orientation);
      // Keep menu open for size selection
      return;
    }
    
    setSelectedTool(activeMenu);
    setPendingToolOrientation(orientation);
    setIsMenuOpen(false);
    setActiveMenu(null);
  }, [activeMenu, pendingBoothCategory]);

  // Handle template selection from menu
  const handleTemplateSelect = useCallback((templateKey) => {
    setSelectedTool('table');
    setPendingToolOrientation(`template-${templateKey}`);
    setIsMenuOpen(false);
    setActiveMenu(null);
  }, []);

  // Handle item placement
  const handlePlaceItem = useCallback((x, y) => {
    if (selectedTool === 'select' && !pendingToolOrientation?.startsWith('template-')) return;

    // If a template is selected, place all template items
    if (pendingToolOrientation?.startsWith('template-')) {
      const templateKey = pendingToolOrientation.replace('template-', '');
      const template = TEMPLATES[templateKey];
      if (!template) return;

            // Handle image-based templates
      if (template.isImage) {
        const newItem = {
          id: `template-${templateKey}-${Date.now()}`,
          x: snapToGrid(x - template.width / 2),
          y: snapToGrid(y - template.height / 2),
          type: 'template-image',
          templateKey: templateKey,
          label: toolLabel || template.name,
          width: template.width,
          height: template.height,
          image: template.image || null, // Allow null initially
          rotation: 0,
        };

        const newItems = [...items, newItem];
        updateItems(newItems);
        setSelectedItems([newItem.id]);
        setToolLabel('');
        return;
      }

      // Handle multi-item templates
      const boundingBox = template.items.reduce((acc, item) => {
        const x1 = item.offsetX;
        const y1 = item.offsetY;
        const x2 = item.offsetX + item.width;
        const y2 = item.offsetY + item.height;
        
        return {
          minX: Math.min(acc.minX, x1),
          minY: Math.min(acc.minY, y1),
          maxX: Math.max(acc.maxX, x2),
          maxY: Math.max(acc.maxY, y2),
        };
      }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

      const centerX = (boundingBox.minX + boundingBox.maxX) / 2;
      const centerY = (boundingBox.minY + boundingBox.maxY) / 2;

      const snappedCenterX = snapToGrid(x + centerX);
      const snappedCenterY = snapToGrid(y + centerY);

      const offsetX = snappedCenterX - (x + centerX);
      const offsetY = snappedCenterY - (y + centerY);

      const baseX = x + offsetX;
      const baseY = y + offsetY;

      const newItems = template.items.map((templateItem, index) => ({
        id: `${templateItem.type}-${Date.now()}-${index}`,
        x: Math.round(baseX + templateItem.offsetX),
        y: Math.round(baseY + templateItem.offsetY),
        type: templateItem.type,
        label: templateItem.label || '',
        width: templateItem.width,
        height: templateItem.height,
        orientation: templateItem.orientation || 'horizontal',
        rotation: templateItem.rotation || 0,
      }));

      const allItems = [...items, ...newItems];
      updateItems(allItems);
      setSelectedItems(newItems.map(item => item.id));
      setToolLabel('');
      return;
    }

    // For pipe-and-drape, separator, table, and booth, require orientation/shape to be set
    if ((selectedTool === 'pipe-and-drape' || selectedTool === 'separator' || selectedTool === 'table' || selectedTool === 'booth') && !pendingToolOrientation) {
      setActiveMenu(selectedTool);
      setIsMenuOpen(true);
      return;
    }

    const newItem = {
      id: `${selectedTool}-${Date.now()}`,
      x: snapToGrid(x),
      y: snapToGrid(y),
      type: selectedTool,
      label: toolLabel,
      width: getDefaultWidth(selectedTool, pendingToolOrientation),
      height: getDefaultHeight(selectedTool, pendingToolOrientation),
      orientation: pendingToolOrientation || 'horizontal',
      rotation: 0,
      // Add booth category color
      ...(selectedTool === 'booth' && pendingBoothCategory ? { color: BOOTH_COLORS[pendingBoothCategory] } : {}),
    };

    const newItems = [...items, newItem];
    updateItems(newItems);
    setSelectedItems([newItem.id]);
    setToolLabel('');
  }, [selectedTool, items, pendingToolOrientation, pendingBoothCategory, toolLabel]);

  // Handle item selection
  const handleSelectItem = useCallback((itemId, multiSelect = false) => {
    if (itemId === null) {
      setSelectedItems([]);
      return;
    }
    if (!multiSelect) {
      setSelectedItems([itemId]);
    } else {
      setSelectedItems(prev =>
        prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
      );
    }
  }, []);

  // Handle item movement
  const handleMoveItem = useCallback((itemId, x, y) => {
    const newItems = items.map(item =>
      item.id === itemId ? { ...item, x: snapToGrid(x), y: snapToGrid(y) } : item
    );
    updateItems(newItems);
  }, [items]);

  // Handle moving multiple items at once
  const handleMoveManyItems = useCallback((moves) => {
    const newItems = items.map(item => {
      const move = moves.find(m => m.id === item.id);
      return move ? { ...item, x: snapToGrid(move.x), y: snapToGrid(move.y) } : item;
    });
    updateItems(newItems);
  }, [items]);

  // Handle item property update
  const handleUpdateItem = useCallback((itemId, updates) => {
    const newItems = items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    updateItems(newItems);
    
    // Update template image if it's a template item
    if (updates.image && items.find(item => item.id === itemId)?.templateKey) {
      const templateKey = items.find(item => item.id === itemId).templateKey;
      const template = TEMPLATES[templateKey];
      if (template) {
        template.image = updates.image;
      }
    }
  }, [items]);

  // Delete selected items
  const handleDeleteItems = useCallback(() => {
    const newItems = items.filter(item => !selectedItems.includes(item.id));
    updateItems(newItems);
    setSelectedItems([]);
  }, [items, selectedItems]);

  // Copy selected items
  const handleCopy = useCallback(() => {
    if (selectedItems.length > 0) {
      const itemsToCopy = items.filter(item => selectedItems.includes(item.id));
      setClipboard(itemsToCopy);
    }
  }, [items, selectedItems]);

  // Paste items
  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return;

    const offset = { x: 20, y: 20 };
    const pastedItems = clipboard.map(item => ({
      ...item,
      id: `${item.type}-${Date.now()}-${Math.random()}`,
      x: item.x + offset.x,
      y: item.y + offset.y,
    }));

    const newItems = [...items, ...pastedItems];
    updateItems(newItems);
    setSelectedItems(pastedItems.map(item => item.id));
  }, [clipboard, items]);

  // Select all items
  const handleSelectAll = useCallback(() => {
    setSelectedItems(items.map(item => item.id));
  }, [items]);

  // Update items and add to history
  const updateItems = useCallback((newItems) => {
    setItems(newItems);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ items: newItems });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setItems(history[newIndex].items);
      setSelectedItems([]);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setItems(history[newIndex].items);
      setSelectedItems([]);
    }
  }, [history, historyIndex]);

  // Zoom in
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  }, []);

  // Zoom out
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.1, 0.1));
  }, []);

  // Reset zoom
  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  // Export all rooms as JSON
  const handleExportAllRooms = useCallback(() => {
    const data = {
      rooms: rooms,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-rooms.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [rooms]);

  // Export current room only
  const handleExportRoom = useCallback(() => {
    const data = {
      room: selectedRoom,
      items: items,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedRoom}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items, selectedRoom]);

  // Import JSON
  const handleImportJSON = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result);
        
        // Check if it's all-rooms format
        if (json.rooms && typeof json.rooms === 'object') {
          setRooms(json.rooms);
          saveAllRoomsToLocalStorage(json.rooms);
          alert('All rooms imported successfully!');
        } 
        // Check if it's single room format (with "booths" or "items" key)
        else if (json.room && (json.booths || json.items)) {
          const boothItems = json.booths || json.items;
          if (Array.isArray(boothItems)) {
            const updatedRooms = {
              ...rooms,
              [json.room]: {
                ...rooms[json.room],
                booths: boothItems
              }
            };
            setRooms(updatedRooms);
            saveAllRoomsToLocalStorage(updatedRooms);
            alert(`Room "${json.room}" imported successfully!`);
          } else {
            alert('Invalid JSON format. Expected booths or items to be an array.');
          }
        } 
        else {
          alert('Invalid JSON format. Expected either all-rooms.json or a single room file with "booths" or "items" array.');
        }
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        alert('Failed to parse JSON file: ' + error.message);
      }
    };
    reader.readAsText(file);
  }, [rooms]);

  // Trigger file input click
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Render tool menu - moved outside as a separate JSX, not a function
  const menuConfigs = {
    'pipe-and-drape': {
      title: 'Pipe & Drape Orientation',
      options: [
        { label: 'Horizontal', icon: '━━━', value: 'horizontal', type: 'shape' },
        { label: 'Vertical', icon: '┃\n┃\n┃', value: 'vertical', type: 'shape' }
      ]
    },
    'separator': {
      title: 'Separator Orientation',
      options: [
        { label: 'Horizontal', icon: '━━━', value: 'horizontal', type: 'shape' },
        { label: 'Vertical', icon: '┃\n┃\n┃', value: 'vertical', type: 'shape' }
      ]
    },
    'table': {
      title: 'Table Shape',
      options: [
        { label: 'Round', icon: '◯', value: 'round', type: 'shape' },
        { label: 'Vertical', icon: '▭', value: 'vertical', type: 'shape' },
        { label: 'Horizontal', icon: '▬', value: 'horizontal', type: 'shape' },
        { label: '━━━', icon: '', value: 'divider', type: 'divider' },
        { label: 'Round Table + 10 Chairs', icon: '◯🪑', value: 'round-table-10', type: 'template' },
      ]
    },
    'booth': {
      title: pendingBoothCategory ? 'Booth Size' : 'Booth Type',
      options: pendingBoothCategory ? [
        { label: 'Single', icon: '□', value: 'single', type: 'shape' },
        { label: 'Horizontal Double', icon: '▬', value: 'horizontal', type: 'shape' },
        { label: 'Vertical Double', icon: '▭', value: 'vertical', type: 'shape' }
      ] : [
        { label: 'Celebrity', icon: '⭐', value: 'celebrity', type: 'category', color: '#ef4444' },
        { label: 'Vendor', icon: '🛍️', value: 'vendor', type: 'category', color: '#22c55e' },
        { label: 'Guest', icon: '👤', value: 'guest', type: 'category', color: '#3b82f6' },
        { label: 'Other', icon: '◯', value: 'other', type: 'category', color: '#6b7280' }
      ]
    }
  };

  const config = isMenuOpen && activeMenu ? menuConfigs[activeMenu] : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>PlanetMapBuilder</h1>
          <span className="version">v1.0</span>
        </div>

        <div className="zoom-controls">
          <button
            className="btn-icon"
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            −
          </button>
          <span className="zoom-display">{Math.round(zoom * 100)}%</span>
          <button
            className="btn-icon"
            onClick={handleZoomIn}
            title="Zoom In"
          >
            +
          </button>
          <button
            className="btn-icon"
            onClick={handleZoomReset}
            title="Reset Zoom"
          >
            ⊙
          </button>
        </div>

        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle Toolbar"
          >
            ☰
          </button>
          <button
            className="btn-icon"
            onClick={() => setRoomsOpen(!roomsOpen)}
            title="Toggle Rooms"
          >
            📋
          </button>
          <button
            className="btn-icon"
            onClick={() => setPropsOpen(!propsOpen)}
            title="Toggle Properties"
          >
            ⚙️
          </button>
          <button className="btn btn-secondary" onClick={handleImportClick}>
            ↑ Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            style={{ display: 'none' }}
          />
          <button className="btn btn-secondary" onClick={handleExportRoom}>
            ↓ Export Room
          </button>
          <button className="btn btn-secondary" onClick={handleExportAllRooms}>
            ↓ Export All
          </button>
        </div>
      </header>

      <div className="app-container">
        {sidebarOpen && (
          <Toolbar
            selectedTool={selectedTool}
            onSelectTool={handleSelectTool}
            onDelete={handleDeleteItems}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onSelectAll={handleSelectAll}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            selectedItemCount={selectedItems.length}
            toolLabel={toolLabel}
            onToolLabelChange={setToolLabel}
          />
        )}

        <div className="main-content">
          {roomsOpen && (
            <RoomSelector
              rooms={rooms}
              selectedRoom={selectedRoom}
              onSelectRoom={setSelectedRoom}
            />
          )}

          <Canvas
            ref={canvasRef}
            room={rooms[selectedRoom]}
            items={items}
            selectedItems={selectedItems}
            selectedTool={selectedTool}
            zoom={zoom}
            onPlaceItem={handlePlaceItem}
            onSelectItem={handleSelectItem}
            onMoveItem={handleMoveItem}
            onMoveManyItems={handleMoveManyItems}
          />
        </div>

        {propsOpen && (
          <PropertiesPanel
            selectedItems={items.filter(item => selectedItems.includes(item.id))}
            onUpdateItem={handleUpdateItem}
          />
        )}
      </div>

      {config && isMenuOpen && (
        <div className="tool-menu-overlay" onClick={() => setIsMenuOpen(false)}>
          <div className="tool-menu" onClick={(e) => e.stopPropagation()}>
            <h3>{config.title}</h3>
            {pendingBoothCategory && activeMenu === 'booth' && (
              <button
                className="menu-back-button"
                onClick={() => setPendingBoothCategory(null)}
              >
                ← Back
              </button>
            )}
            {config.options.map(option => {
              if (option.type === 'divider') {
                return <div key={option.value} className="menu-divider" />;
              }
              return (
                <button
                  key={option.value}
                  className="menu-option"
                  style={option.color ? { borderLeft: `4px solid ${option.color}` } : {}}
                  onClick={() => {
                    if (option.type === 'template') {
                      handleTemplateSelect(option.value);
                    } else {
                      handleToolMenuSelect(option.value);
                    }
                  }}
                >
                  <span className="icon">{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions for default dimensions
function getDefaultWidth(toolType, orientation = null) {
  if (toolType === 'table') {
    if (orientation === 'round') return 20;
    if (orientation === 'vertical') return 7;
    if (orientation === 'horizontal') return 20;
  }
  if (toolType === 'pipe-and-drape') {
    return orientation === 'vertical' ? 2 : 35;
  }
  if (toolType === 'separator') {
    return orientation === 'vertical' ? 2 : 35;
  }
  if (toolType === 'booth') {
    if (orientation === 'horizontal') return 60;
    if (orientation === 'vertical') return 30;
    if (orientation === 'single') return 30;
  }

  const widths = {
    chair: 5,
    signage: 60,
    booth: 30,
    counter: 120,
    shelf: 100,
  };
  return widths[toolType] || 80;
}

function getDefaultHeight(toolType, orientation = null) {
  if (toolType === 'table') {
    if (orientation === 'round') return 20;
    if (orientation === 'vertical') return 20;
    if (orientation === 'horizontal') return 7;
  }
  if (toolType === 'pipe-and-drape') {
    return orientation === 'vertical' ? 35 : 2;
  }
  if (toolType === 'separator') {
    return orientation === 'vertical' ? 35 : 2;
  }
  if (toolType === 'booth') {
    if (orientation === 'vertical') return 60;
    if (orientation === 'horizontal') return 30;
    if (orientation === 'single') return 30;
  }

  const heights = {
    chair: 5,
    signage: 100,
    booth: 30,
    counter: 60,
    shelf: 50,
  };
  return heights[toolType] || 80;
}

// Snap coordinate to grid
function snapToGrid(value, gridSize = GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

export default App;