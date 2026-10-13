import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { CONTOUR_DEFAULTS, PRODUCTION_LAYERS } from '../../config/constants';
import { CanvasRulers } from './CanvasRulers';
import { FloatingCanvasControls } from './FloatingCanvasControls';

export const InteractiveCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    mediaConfig,
    layoutResult,
    artworkList,
    selectedArtworkId,
    selectArtwork,
    layers,
    viewport,
    setViewport,
  } = useProjectStore();

  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });

  // Reactive cache for artwork image elements with dataUrl tracking
  const imagesCacheRef = useRef<Record<string, { img: HTMLImageElement; dataUrl: string; loaded: boolean }>>({});
  const [renderVersion, setRenderVersion] = useState<number>(0);

  useEffect(() => {
    let hasImmediateChange = false;
    artworkList.forEach((asset) => {
      if (!asset.dataUrl) return;
      const cached = imagesCacheRef.current[asset.id];
      if (!cached || cached.dataUrl !== asset.dataUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = asset.dataUrl;
        imagesCacheRef.current[asset.id] = { img, dataUrl: asset.dataUrl, loaded: false };
        hasImmediateChange = true;

        img.onload = () => {
          if (imagesCacheRef.current[asset.id]?.dataUrl === asset.dataUrl) {
            imagesCacheRef.current[asset.id].loaded = true;
            setRenderVersion((prev) => prev + 1);
          }
        };
      }
    });

    if (hasImmediateChange) {
      setRenderVersion((prev) => prev + 1);
    }
  }, [artworkList]);

  // Handle ResizeObserver for dynamic full-screen canvas with integer debounced state
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const newW = Math.floor(entry.contentRect.width);
        const newH = Math.floor(entry.contentRect.height);
        if (newW > 0 && newH > 0) {
          setContainerSize((prev) => {
            if (prev.width === newW && prev.height === newH) return prev;
            return { width: newW, height: newH };
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Sync canvas backing store dimensions ONLY when containerSize changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerSize.width * dpr;
    canvas.height = containerSize.height * dpr;
  }, [containerSize]);

  // Compute pixels-per-millimeter based on viewport zoom
  // Baseline: 1mm = 2.0 pixels at 100% zoom
  const mmToPx = 2.0 * viewport.zoom;

  // Media dimensions in canvas screen pixels
  const sheetWidthPx = mediaConfig.widthMm * mmToPx;
  const sheetHeightPx = mediaConfig.heightMm * mmToPx;

  // Center sheet on canvas with viewport pan offset
  const sheetOriginX = (containerSize.width - sheetWidthPx) / 2 + viewport.panX;
  const sheetOriginY = (containerSize.height - sheetHeightPx) / 2 + viewport.panY;

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Clear background (Dark studio gray)
    ctx.fillStyle = '#0f0f12';
    ctx.fillRect(0, 0, containerSize.width, containerSize.height);

    // 2. Render Media Substrate (White sheet with shadow)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sheetOriginX, sheetOriginY, sheetWidthPx, sheetHeightPx);
    ctx.restore();

    // Subtle sheet border
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1;
    ctx.strokeRect(sheetOriginX, sheetOriginY, sheetWidthPx, sheetHeightPx);

    // 3. Render Pinch Roller Safe Margins (Dashed Red Lines)
    const margins = mediaConfig.marginsMm;
    const safeLeft = sheetOriginX + margins.left * mmToPx;
    const safeRight = sheetOriginX + (mediaConfig.widthMm - margins.right) * mmToPx;
    const safeTop = sheetOriginY + margins.top * mmToPx;
    const safeBottom = sheetOriginY + (mediaConfig.heightMm - margins.bottom) * mmToPx;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'; // Soft red margin indicator
    ctx.lineWidth = 1;
    ctx.strokeRect(safeLeft, safeTop, Math.max(0, safeRight - safeLeft), Math.max(0, safeBottom - safeTop));
    ctx.restore();

    // 4. Render Registration Marks (Layer: layer_reg_marks)
    const regLayer = layers[PRODUCTION_LAYERS.REG_MARKS.id];
    if (regLayer?.visible && layoutResult.registrationMarks.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.lineWidth = Math.max(1, (layoutResult.registrationMarks[0]?.lines[0] ? 0.5 : 0.5) * mmToPx);
      ctx.lineCap = 'square';

      for (const mark of layoutResult.registrationMarks) {
        // Draw lines
        for (const line of mark.lines) {
          const x1 = sheetOriginX + line.x1 * mmToPx;
          const y1 = sheetOriginY + line.y1 * mmToPx;
          const x2 = sheetOriginX + line.x2 * mmToPx;
          const y2 = sheetOriginY + line.y2 * mmToPx;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Draw circles (for Roland BN-20 targets)
        if (mark.circles) {
          for (const circle of mark.circles) {
            const cx = sheetOriginX + circle.cx * mmToPx;
            const cy = sheetOriginY + circle.cy * mmToPx;
            const r = circle.r * mmToPx;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            if (circle.filled) {
              ctx.fill();
            } else {
              ctx.stroke();
            }
          }
        }

        // Draw rects (for Summa OPOS solid square targets & DataLink barcodes)
        if (mark.rects) {
          for (const rect of mark.rects) {
            const rx = sheetOriginX + rect.x * mmToPx;
            const ry = sheetOriginY + rect.y * mmToPx;
            const rw = rect.w * mmToPx;
            const rh = rect.h * mmToPx;
            if (rect.filled) {
              ctx.fillRect(rx, ry, rw, rh);
            } else {
              ctx.strokeRect(rx, ry, rw, rh);
            }
          }
        }
      }
      ctx.restore();
    }

    // 5. Render Artwork Instances (Layer: layer_artwork)
    const artworkLayer = layers[PRODUCTION_LAYERS.ARTWORK.id];
    if (artworkLayer?.visible) {
      for (const inst of layoutResult.instances) {
        const cached = imagesCacheRef.current[inst.artworkId];
        const instXPx = sheetOriginX + inst.xMm * mmToPx;
        const instYPx = sheetOriginY + inst.yMm * mmToPx;
        const rawWPx = (inst.rawWidthMm || inst.widthMm) * mmToPx;
        const rawHPx = (inst.rawHeightMm || inst.heightMm) * mmToPx;

        ctx.save();
        ctx.translate(instXPx, instYPx);
        if (inst.rotationDeg !== 0) {
          ctx.rotate((inst.rotationDeg * Math.PI) / 180);
        }

        if (cached && (cached.loaded || (cached.img.complete && cached.img.naturalWidth > 0))) {
          ctx.drawImage(cached.img, -rawWPx / 2, -rawHPx / 2, rawWPx, rawHPx);
        } else {
          // Placeholder card while image is loading
          ctx.fillStyle = '#27272a';
          ctx.fillRect(-rawWPx / 2, -rawHPx / 2, rawWPx, rawHPx);
        }
        ctx.restore();
      }
    }

    // 6. Render Bleed Overlap (Layer: layer_bleed_overlap)
    const bleedLayer = layers[PRODUCTION_LAYERS.BLEED_OVERLAP.id];
    if (bleedLayer?.visible) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)'; // Amber dashed bleed guide
      ctx.lineWidth = Math.max(1, 0.5 * mmToPx);
      ctx.setLineDash([4, 3]);

      for (const inst of layoutResult.instances) {
        const instXPx = sheetOriginX + inst.xMm * mmToPx;
        const instYPx = sheetOriginY + inst.yMm * mmToPx;
        const bleedOffsetMm = 2.0; // 2mm bleed allowance
        const bleedWPx = ((inst.rawWidthMm || inst.widthMm) + bleedOffsetMm * 2) * mmToPx;
        const bleedHPx = ((inst.rawHeightMm || inst.heightMm) + bleedOffsetMm * 2) * mmToPx;

        ctx.save();
        ctx.translate(instXPx, instYPx);
        if (inst.rotationDeg !== 0) {
          ctx.rotate((inst.rotationDeg * Math.PI) / 180);
        }
        ctx.strokeRect(-bleedWPx / 2, -bleedHPx / 2, bleedWPx, bleedHPx);
        ctx.restore();
      }
      ctx.restore();
    }

    // 7. Render Cut Contour Paths (Layer: layer_cut_contour)
    const contourLayer = layers[PRODUCTION_LAYERS.CUT_CONTOUR.id];
    if (contourLayer?.visible) {
      ctx.save();
      ctx.strokeStyle = CONTOUR_DEFAULTS.CUT_CONTOUR_HEX; // Vibrant Neon Pink (#FF007F)

      for (const inst of layoutResult.instances) {
        if (!inst.contourPath) continue;

        const instXPx = sheetOriginX + inst.xMm * mmToPx;
        const instYPx = sheetOriginY + inst.yMm * mmToPx;

        ctx.save();
        ctx.translate(instXPx, instYPx);
        if (inst.rotationDeg !== 0) {
          ctx.rotate((inst.rotationDeg * Math.PI) / 180);
        }

        // Draw SVG path via Path2D with mmToPx scaling and crisp screen stroke width
        try {
          const path2d = new Path2D(inst.contourPath);
          ctx.scale(mmToPx, mmToPx);
          ctx.lineWidth = Math.max(0.18, 1.25 / mmToPx); // Crisp 1.25px screen width
          ctx.stroke(path2d);
        } catch {
          // Fallback to bounding box rectangle
          const rawW = (inst.rawWidthMm || inst.widthMm) * mmToPx;
          const rawH = (inst.rawHeightMm || inst.heightMm) * mmToPx;
          ctx.lineWidth = Math.max(1, 0.35 * mmToPx);
          ctx.strokeRect(-rawW / 2, -rawH / 2, rawW, rawH);
        }
        ctx.restore();
      }
      ctx.restore();
    }

    // 8. Render Path Line - Crease/Perf (Layer: layer_path_line)
    const pathLineLayer = layers[PRODUCTION_LAYERS.PATH_LINE.id];
    if (pathLineLayer?.visible) {
      ctx.save();
      ctx.strokeStyle = PRODUCTION_LAYERS.PATH_LINE.color; // Distinct Cyan (#06B6D4)
      ctx.setLineDash([4, 2]); // Dashed crease/perforation indicator

      for (const inst of layoutResult.instances) {
        const instXPx = sheetOriginX + inst.xMm * mmToPx;
        const instYPx = sheetOriginY + inst.yMm * mmToPx;

        ctx.save();
        ctx.translate(instXPx, instYPx);
        if (inst.rotationDeg !== 0) {
          ctx.rotate((inst.rotationDeg * Math.PI) / 180);
        }

        if (inst.contourPath) {
          try {
            const path2d = new Path2D(inst.contourPath);
            ctx.scale(mmToPx * 0.95, mmToPx * 0.95);
            ctx.lineWidth = Math.max(0.18, 1.25 / (mmToPx * 0.95));
            ctx.stroke(path2d);
          } catch {
            const rawW = (inst.rawWidthMm || inst.widthMm) * 0.95 * mmToPx;
            const rawH = (inst.rawHeightMm || inst.heightMm) * 0.95 * mmToPx;
            ctx.lineWidth = Math.max(1, 0.35 * mmToPx);
            ctx.strokeRect(-rawW / 2, -rawH / 2, rawW, rawH);
          }
        } else {
          const rawW = (inst.rawWidthMm || inst.widthMm) * 0.95 * mmToPx;
          const rawH = (inst.rawHeightMm || inst.heightMm) * 0.95 * mmToPx;
          ctx.lineWidth = Math.max(1, 0.35 * mmToPx);
          ctx.strokeRect(-rawW / 2, -rawH / 2, rawW, rawH);
        }
        ctx.restore();
      }
      ctx.restore();
    }

    ctx.restore();
  }, [
    containerSize,
    sheetOriginX,
    sheetOriginY,
    sheetWidthPx,
    sheetHeightPx,
    mmToPx,
    mediaConfig,
    layoutResult,
    layers,
    artworkList,
    renderVersion,
  ]);

  useEffect(() => {
    let animId = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.15), 5.0);
    setViewport({ zoom: newZoom });
  };

  // Mouse Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewport.panX, y: e.clientY - viewport.panY });
      setMouseDownPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setViewport({
        panX: e.clientX - dragStart.x,
        panY: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging && e.button === 0) {
      const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
      if (dist < 4) {
        // User clicked without dragging - select instance under cursor
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          const mmX = (clickX - sheetOriginX) / mmToPx;
          const mmY = (clickY - sheetOriginY) / mmToPx;

          for (let i = layoutResult.instances.length - 1; i >= 0; i--) {
            const inst = layoutResult.instances[i];
            const halfW = inst.widthMm / 2;
            const halfH = inst.heightMm / 2;
            if (
              mmX >= inst.xMm - halfW &&
              mmX <= inst.xMm + halfW &&
              mmY >= inst.yMm - halfH &&
              mmY <= inst.yMm + halfH
            ) {
              selectArtwork(inst.artworkId);
              break;
            }
          }
        }
      }
    }
    setIsDragging(false);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'relative',
        flex: 1,
        height: 'calc(100vh - 48px - 32px)',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor: '#0f0f12',
      }}
    >
      <CanvasRulers
        canvasWidth={containerSize.width}
        canvasHeight={containerSize.height}
        scale={mmToPx}
        offsetX={sheetOriginX}
        offsetY={sheetOriginY}
      />

      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      <FloatingCanvasControls />
    </div>
  );
};
