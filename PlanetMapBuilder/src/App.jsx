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

// Grid snap size
const GRID_SIZE = 5;

function App() {
  const [rooms, setRooms] = useState(sampleData.rooms);
  const [selectedRoom, setSelectedRoom] = useState('hall-d');
  const [items, setItems] = useState(sampleData.rooms['hall-d']?.booths || []);
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
  const canvasRef = useRef(null);

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
    if (toolId === 'pipe-and-drape' || toolId === 'separator' || toolId === 'table') {
      setActiveMenu(toolId);
      setIsMenuOpen(true);
      setPendingToolOrientation(null);
    } else {
      setSelectedTool(toolId);
      setIsMenuOpen(false);
      setPendingToolOrientation(null);
    }
  }, []);

  // Handle tool menu selection
  const handleToolMenuSelect = useCallback((orientation) => {
    setSelectedTool(activeMenu);
    setPendingToolOrientation(orientation);
    setIsMenuOpen(false);
    setActiveMenu(null);
  }, [activeMenu]);

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
          label: template.name,
          width: template.width,
          height: template.height,
          image: template.image || null, // Allow null initially
          rotation: 0,
        };

        const newItems = [...items, newItem];
        updateItems(newItems);
        setSelectedItems([newItem.id]);
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
      return;
    }

    // For pipe-and-drape, separator, and table, require orientation/shape to be set
    if ((selectedTool === 'pipe-and-drape' || selectedTool === 'separator' || selectedTool === 'table') && !pendingToolOrientation) {
      setActiveMenu(selectedTool);
      setIsMenuOpen(true);
      return;
    }

    const newItem = {
      id: `${selectedTool}-${Date.now()}`,
      x: snapToGrid(x),
      y: snapToGrid(y),
      type: selectedTool,
      label: '',
      width: getDefaultWidth(selectedTool, pendingToolOrientation),
      height: getDefaultHeight(selectedTool, pendingToolOrientation),
      orientation: pendingToolOrientation || 'horizontal',
      rotation: 0,
    };

    const newItems = [...items, newItem];
    updateItems(newItems);
    setSelectedItems([newItem.id]);
  }, [selectedTool, items, pendingToolOrientation]);

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

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  // Update items with history
  const updateItems = (newItems) => {
    setItems(newItems);

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ items: newItems });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    setRooms(prev => ({
      ...prev,
      [selectedRoom]: {
        ...prev[selectedRoom],
        booths: newItems,
      },
    }));
  };

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

  // Export JSON
  const handleExportJSON = useCallback(() => {
    const exportData = {
      rooms: Object.fromEntries(
        Object.entries(rooms).map(([key, room]) => [
          key,
          {
            ...room,
            booths: room.booths,
          },
        ])
      ),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'map-layout.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [rooms]);

    // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT');

      if (isInputActive) {
        if (e.key === 'Escape') {
          activeElement.blur();
        }
        return;
      }

      // CHECK CTRL/CMD COMBINATIONS
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        handleZoomIn();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleZoomReset();
        return;
      }

      // DELETE/BACKSPACE AND ESCAPE
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItems.length > 0 && selectedTool === 'select') {
        e.preventDefault();
        handleDeleteItems();
        return;
      }

      if (e.key === 'Escape') {
        setSelectedItems([]);
        setSelectedTool('select');
        setIsMenuOpen(false);
        setActiveMenu(null);
        setPendingToolOrientation(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, selectedTool, handleUndo, handleRedo, handleCopy, handlePaste, handleSelectAll, handleDeleteItems, handleZoomIn, handleZoomOut, handleZoomReset]);
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
        { label: 'Round Table + 6 Chairs', icon: '◯🪑', value: 'round-table-6', type: 'template' },
        { label: 'Round Table + 8 Chairs', icon: '◯🪑', value: 'round-table-8', type: 'template' },
        { label: 'Round Table + 10 Chairs', icon: '◯🪑', value: 'round-table-10', type: 'template' },
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
            title="Zoom Out (Ctrl+-)"
          >
            −
          </button>
          <span className="zoom-display">{Math.round(zoom * 100)}%</span>
          <button
            className="btn-icon"
            onClick={handleZoomIn}
            title="Zoom In (Ctrl++)"
          >
            +
          </button>
          <button
            className="btn-icon"
            onClick={handleZoomReset}
            title="Reset Zoom (Ctrl+0)"
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
          <button className="btn btn-secondary" onClick={handleExportJSON}>
            ↓ Export JSON
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
            {config.options.map(option => {
              if (option.type === 'divider') {
                return <div key={option.value} className="menu-divider" />;
              }
              return (
                <button
                  key={option.value}
                  className="menu-option"
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