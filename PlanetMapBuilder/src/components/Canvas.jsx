import React, { useRef, useEffect, useState, useCallback } from 'react';
import '../styles/Canvas.css';

const imageCache = new Map();
const loadingCallbacks = new Map();

function loadImage(src, onLoad) {
  if (imageCache.has(src)) {
    const img = imageCache.get(src);
    if (img.complete && img.naturalWidth > 0 && onLoad) {
      onLoad(img);
    }
    return img;
  }
  
   const img = new Image();
  img.crossOrigin = 'anonymous';
  
  // Call onLoad when image is ready
  if (onLoad) {
    img.addEventListener('load', () => {
      onLoad(img);
    });
    img.addEventListener('error', () => {
      console.error(`Failed to load image: ${src}`);
    });
  }
  
  img.src = src;
  imageCache.set(src, img);
  return img;
}

const Canvas = React.forwardRef(({
  room,
  items,
  selectedItems,
  selectedTool,
  zoom = 1,
  onPlaceItem,
  onSelectItem,
  onMoveItem,
  onMoveManyItems,
}, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItems, setDraggedItems] = useState([]);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [lassoPath, setLassoPath] = useState([]);
  const [isDrawingLasso, setIsDrawingLasso] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 2595, height: 2384 });

  const baseImage = room?.baseImage;
  const imagePath = baseImage ? `${baseImage}` : null;

  // Load image once and store in ref
  useEffect(() => {
    if (!imagePath) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      console.warn(`Failed to load image: ${imagePath}`);
    };
    img.src = imagePath;
  }, [imagePath]);

    // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width, height);

    // Save state and apply transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw grid
    ctx.strokeStyle = '#d0d9e8';
    ctx.lineWidth = 0.5 / zoom;
    const gridSize = 5;
    const startX = Math.floor(-pan.x / zoom / gridSize) * gridSize;
    const startY = Math.floor(-pan.y / zoom / gridSize) * gridSize;
    const endX = startX + width / zoom + gridSize;
    const endY = startY + height / zoom + gridSize;
    
    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    // Draw background image if loaded
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, imageSize.width, imageSize.height);
    }

    // Draw items and preload template images
    items.forEach(item => {
      const isSelected = selectedItems.includes(item.id);
      if (item.type === 'template-image' && item.image) {
        // Preload template images
        loadImage(item.image, () => {
          // Trigger redraw when image loads
          if (canvasRef.current) {
            canvasRef.current.dispatchEvent(new Event('imageLoaded'));
          }
        });
      }
      drawItem(ctx, item, isSelected, zoom);
    });

    // Draw lasso selection
    if (lassoPath.length > 0) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      ctx.beginPath();
      lassoPath.forEach((point, i) => {
        const worldX = (point.x - pan.x) / zoom;
        const worldY = (point.y - pan.y) / zoom;
        if (i === 0) ctx.moveTo(worldX, worldY);
        else ctx.lineTo(worldX, worldY);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [items, selectedItems, lassoPath, zoom, pan, imageSize]);

  // Listen for image load events and redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleImageLoaded = () => {
      // Trigger a re-render by updating a state that affects the draw
      canvas.dispatchEvent(new Event('redraw'));
    };

    canvas.addEventListener('imageLoaded', handleImageLoaded);
    return () => canvas.removeEventListener('imageLoaded', handleImageLoaded);
  }, []);

  // Get item at coordinates (accounting for pan and zoom)
  const getItemAt = useCallback((canvasX, canvasY) => {
    const worldX = (canvasX - pan.x) / zoom;
    const worldY = (canvasY - pan.y) / zoom;

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (
        worldX >= item.x &&
        worldX <= item.x + item.width &&
        worldY >= item.y &&
        worldY <= item.y + item.height
      ) {
        return item;
      }
    }
    return null;
  }, [items, zoom, pan]);

  // Canvas mouse down
  const handleCanvasMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Right click = pan
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x, y });
      return;
    }

    // Middle mouse button = pan
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x, y });
      return;
    }

    if (selectedTool === 'lasso') {
      setIsDrawingLasso(true);
      setLassoPath([{ x, y }]);
      return;
    }

    if (selectedTool === 'select') {
      const clickedItem = getItemAt(x, y);
      
      if (clickedItem) {
        const isAlreadySelected = selectedItems.includes(clickedItem.id);
        
        if (!isAlreadySelected && !e.ctrlKey && !e.metaKey) {
          onSelectItem(clickedItem.id, false);
          const worldX = (x - pan.x) / zoom;
          const worldY = (y - pan.y) / zoom;
          setDragOffset({
            x: worldX - clickedItem.x,
            y: worldY - clickedItem.y,
          });
          setDraggedItems([clickedItem]);
        } else if (isAlreadySelected) {
          const itemsToDrag = items.filter(item => selectedItems.includes(item.id));
          const worldX = (x - pan.x) / zoom;
          const worldY = (y - pan.y) / zoom;
          
          setDragOffset({
            x: worldX - clickedItem.x,
            y: worldY - clickedItem.y,
          });
          setDraggedItems(itemsToDrag);
        } else {
          onSelectItem(clickedItem.id, true);
          const worldX = (x - pan.x) / zoom;
          const worldY = (y - pan.y) / zoom;
          setDragOffset({
            x: worldX - clickedItem.x,
            y: worldY - clickedItem.y,
          });
          setDraggedItems([clickedItem]);
        }
      } else {
        if (!e.ctrlKey && !e.metaKey) {
          onSelectItem(null);
        }
      }
      setIsDragging(true);
    } else {
      const worldX = (x - pan.x) / zoom;
      const worldY = (y - pan.y) / zoom;
      onPlaceItem(worldX, worldY);
    }
  }, [selectedTool, zoom, pan, getItemAt, onPlaceItem, onSelectItem, items, selectedItems]);

  // Canvas mouse move
  const handleCanvasMouseMove = useCallback((e) => {
    if (isPanning) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setPan(prev => ({
        x: prev.x + (x - panStart.x),
        y: prev.y + (y - panStart.y),
      }));
      setPanStart({ x, y });
    } else if (isDrawingLasso) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setLassoPath(prev => [...prev, { x, y }]);
    } else if (isDragging && draggedItems.length > 0) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const worldX = (x - pan.x) / zoom - dragOffset.x;
      const worldY = (y - pan.y) / zoom - dragOffset.y;
      
      const moves = draggedItems.map(draggedItem => ({
        id: draggedItem.id,
        x: Math.round(worldX + (draggedItem.x - draggedItems[0].x)),
        y: Math.round(worldY + (draggedItem.y - draggedItems[0].y)),
      }));
      
      if (draggedItems.length > 1) {
        onMoveManyItems(moves);
      } else {
        onMoveItem(draggedItems[0].id, moves[0].x, moves[0].y);
      }
    }
  }, [isPanning, isDrawingLasso, isDragging, draggedItems, dragOffset, zoom, pan, panStart, onMoveItem, onMoveManyItems]);

  // Canvas mouse up
  const handleCanvasMouseUp = useCallback(() => {
    if (isDrawingLasso && lassoPath.length > 2) {
      const selectedByLasso = items.filter(item => pointInPolygon(
        { x: item.x + item.width / 2, y: item.y + item.height / 2 },
        lassoPath.map(p => ({ x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom }))
      ));
      selectedByLasso.forEach(item => onSelectItem(item.id, true));
    }
    setIsDrawingLasso(false);
    setLassoPath([]);
    setIsDragging(false);
    setDraggedItems([]);
    setIsPanning(false);
  }, [isDrawingLasso, lassoPath, items, zoom, pan, onSelectItem]);

  const handleCanvasMouseLeave = useCallback(() => {
    setIsDrawingLasso(false);
    setLassoPath([]);
    setIsDragging(false);
    setDraggedItems([]);
    setIsPanning(false);
  }, []);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
  }, []);

  // Resize observer for canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    });

    resizeObserver.observe(container);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="canvas-container" ref={containerRef}>
      <div className="canvas-info">
        <span className="room-name">{room?.label || 'No Room Selected'}</span>
        <span className="zoom-info">
          {Math.round(zoom * 100)}% | Pan: ({Math.round(pan.x)}, {Math.round(pan.y)})
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className={`canvas ${isPanning ? 'panning' : ''}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={handleWheel}
      />
      <div className="canvas-help">
        <div className="booth-legend">
          <p className="legend-title">Booth Types</p>
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Celebrity</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
              <span>Vendor</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#3b82f6' }}></span>
              <span>Guest</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#6b7280' }}></span>
              <span>Other</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Helper functions
function drawItem(ctx, item, isSelected, zoom) {
  const x = item.x;
  const y = item.y;
  const w = item.width;
  const h = item.height;
  const rotation = (item.rotation || 0) * (Math.PI / 180);

  const colors = {
    table: '#10b981',
    chair: '#f59e0b',
    separator: '#ef4444',
    'pipe-and-drape': '#8b5cf6',
    signage: '#06b6d4',
    booth: '#3b82f6',
    counter: '#6366f1',
    shelf: '#ec4899',
  };

  ctx.save();
  
  // Rotate around center of item
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rotation);
  ctx.translate(-(w / 2), -(h / 2));

  // Use custom color if set, otherwise use default for type
  ctx.fillStyle = item.color || colors[item.type] || '#6b7280';
  
  // Draw tables with different shapes
  if (item.type === 'table') {
    ctx.fillStyle = item.color || colors[item.type];
    
    if (item.orientation === 'round') {
      const radius = Math.min(w, h) / 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, w, h);
    }
  }
  // Draw pipe & drape and separator with patterns
  else if (item.type === 'pipe-and-drape' || item.type === 'separator') {
    ctx.fillStyle = item.color || colors[item.type];
    ctx.fillRect(0, 0, w, h);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    
    if (item.orientation === 'vertical') {
      for (let i = 0; i < w; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, h);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < h; i += 4) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(w, i);
        ctx.stroke();
      }
    }
  }
  // Draw signage - either with image or colored box
  else if (item.type === 'signage') {
    if (item.image) {
      const img = loadImage(item.image);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        ctx.fillStyle = colors[item.type];
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.fillStyle = colors[item.type];
      ctx.fillRect(0, 0, w, h);
    }
  }
    // Draw template image
  else if (item.type === 'template-image') {
    if (item.image) {
      const img = loadImage(item.image);
      // Draw image if loaded, otherwise placeholder
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, w, h);
      }
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, h);
    }
  }
  else {
    ctx.fillRect(0, 0, w, h);
  }

  if (isSelected) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3 / zoom;
    ctx.strokeRect(-2, -2, w + 4, h + 4);

    const handleSize = 8 / zoom;
    ctx.fillStyle = '#3b82f6';
    const handles = [
      { x: -handleSize / 2, y: -handleSize / 2 },
      { x: w - handleSize / 2, y: -handleSize / 2 },
      { x: -handleSize / 2, y: h - handleSize / 2 },
      { x: w - handleSize / 2, y: h - handleSize / 2 },
    ];
    handles.forEach(handle => {
      ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
    });
  }

  // Draw label text - centered and counter-rotated for readability
  if (w > 20 && h > 20) {
    const displayText = item.label || item.id.substring(0, 8);
    
    // Save the current transform state
    ctx.save();
    
    // Move to center of item for counter-rotation
    ctx.translate(w / 2, h / 2);
    
    // Counter-rotate the text so it stays readable
    // If booth is rotated, text rotates opposite direction
    ctx.rotate(-(item.rotation || 0) * (Math.PI / 180));
    
    // Set up font
    const fontSize = Math.max(Math.min(w, h) / 3, 12 / zoom);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw black stroke around text
    ctx.strokeStyle = '#000';
    ctx.lineWidth = fontSize / 6;
    ctx.strokeText(displayText, 0, 0);
    
    // Draw white filled text on top
    ctx.fillStyle = '#fff';
    ctx.fillText(displayText, 0, 0);
    
    // Restore the transform state
    ctx.restore();
  }

  ctx.restore();
}

function pointInPolygon(point, polygon) {
  if (polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

Canvas.displayName = 'Canvas';

export default Canvas;