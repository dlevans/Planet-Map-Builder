import React, { useRef, useEffect, useState, useCallback } from 'react';
import '../styles/Canvas.css';

const imageCache = new Map();

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

  // Reset pan state to (0,0) when switching rooms to position top-left corner at viewport origin
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [room?.baseImage, room?.label]);

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

    // Draw background image positioned at (0, 0)
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, imageSize.width, imageSize.height);
    }

    // Draw items
    items.forEach(item => {
      const isSelected = selectedItems.includes(item.id);
      if (item.type === 'template-image' && item.image) {
        loadImage(item.image, () => {
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
      canvas.dispatchEvent(new Event('redraw'));
    };

    canvas.addEventListener('imageLoaded', handleImageLoaded);
    return () => canvas.removeEventListener('imageLoaded', handleImageLoaded);
  }, []);

  // Get item at coordinates
  const getItemAt = useCallback((canvasX, canvasY) => {
    const worldX = (canvasX - pan.x) / zoom;
    const worldY = (canvasY - pan.y) / zoom;

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.x === null && item.y === null) continue;
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

    if (e.button === 2 || e.button === 1) {
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
        if (clickedItem.x === null || clickedItem.y === null) {
          onSelectItem(clickedItem.id, false);
          setIsDragging(false);
          return;
        }

        const isAlreadySelected = selectedItems.includes(clickedItem.id);
        const worldX = (x - pan.x) / zoom;
        const worldY = (y - pan.y) / zoom;
        
        if (!isAlreadySelected && !e.ctrlKey && !e.metaKey) {
          onSelectItem(clickedItem.id, false);
          setDragOffset({ x: worldX - clickedItem.x, y: worldY - clickedItem.y });
          setDraggedItems([clickedItem]);
        } else if (isAlreadySelected) {
          const itemsToDrag = items.filter(item => selectedItems.includes(item.id));
          setDragOffset({ x: worldX - clickedItem.x, y: worldY - clickedItem.y });
          setDraggedItems(itemsToDrag);
        } else {
          onSelectItem(clickedItem.id, true);
          setDragOffset({ x: worldX - clickedItem.x, y: worldY - clickedItem.y });
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
        y: prev.y + (y - panStart.y)
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
      const worldX = (x - pan.x) / zoom;
      const worldY = (y - pan.y) / zoom;

      const firstItem = draggedItems[0];
      if (firstItem.x === null || firstItem.y === null) return;
      
      const targetFirstX = snapToGrid(worldX - dragOffset.x);
      const targetFirstY = snapToGrid(worldY - dragOffset.y);
      const dx = targetFirstX - firstItem.x;
      const dy = targetFirstY - firstItem.y;

      if (!isNaN(dx) && !isNaN(dy)) {
        onMoveManyItems(draggedItems.map(item => ({
          id: item.id,
          x: item.x + dx,
          y: item.y + dy
        })));
      }
    }
  }, [isDragging, draggedItems, dragOffset, isPanning, panStart, isDrawingLasso, zoom, pan, onMoveManyItems]);

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

  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
  }, []);

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
              <span className="legend-color" style={{ backgroundColor: '#bcff03' }}></span>
              <span>Info</span>
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

// Primary render function for items
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

  ctx.fillStyle = item.color || colors[item.type] || '#6b7280';
  
  if (item.type === 'table') {
    if (item.orientation === 'round') {
      const radius = Math.min(w, h) / 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, w, h);
    }
  } else if (item.type === 'pipe-and-drape' || item.type === 'separator') {
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
  } else if (item.type === 'signage' || item.type === 'template-image') {
    if (item.image) {
      const img = loadImage(item.image);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, w, h);
    }
  } else {
    ctx.fillRect(0, 0, w, h);
  }

  // Draw selection bounding outline & handles
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

  // Draw fitted label
  drawFitText(ctx, item.label, 0, 0, w, h, zoom);

  ctx.restore();
}

// Dynamic fit text helper
function drawFitText(ctx, text, x, y, width, height, zoom) {
  if (!text) return;

  // Don't render text if zoomed out too far
  if (zoom < 0.45) return;

  const padding = 4;
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  let fontSize = Math.min(Math.floor(availableHeight * 0.4), 13);
  if (fontSize < 8) fontSize = 8;

  ctx.save();
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Truncate text with ellipsis if it overflows booth width
  let truncatedText = text;
  if (ctx.measureText(truncatedText).width > availableWidth) {
    while (truncatedText.length > 0 && ctx.measureText(truncatedText + '…').width > availableWidth) {
      truncatedText = truncatedText.slice(0, -1);
    }
    truncatedText += '…';
  }

  const textMetrics = ctx.measureText(truncatedText);
  const badgeWidth = textMetrics.width + 6;
  const badgeHeight = fontSize + 4;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // White backdrop badge for high-contrast reading
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(
    centerX - badgeWidth / 2,
    centerY - badgeHeight / 2,
    badgeWidth,
    badgeHeight
  );

  // Label text
  ctx.fillStyle = '#1e293b';
  ctx.fillText(truncatedText, centerX, centerY);
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

function snapToGrid(value, gridSize = 5) {
  return Math.round(value / gridSize) * gridSize;
}

Canvas.displayName = 'Canvas';

export default Canvas;