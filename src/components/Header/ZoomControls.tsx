import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';

export const ZoomControls: React.FC = () => {
  const { viewport, setViewport, resetViewport } = useProjectStore();

  const handleZoomIn = () => {
    setViewport({ zoom: Math.min(viewport.zoom * 1.2, 5.0) });
  };

  const handleZoomOut = () => {
    setViewport({ zoom: Math.max(viewport.zoom / 1.2, 0.15) });
  };

  const handleFitToScreen = () => {
    const media = useProjectStore.getState().mediaConfig;
    const fitZoom = Math.min(1.0, Math.min(750 / (media.widthMm * 2), 650 / (media.heightMm * 2)));
    setViewport({ zoom: Math.max(fitZoom, 0.08), panX: 0, panY: 0 });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#18181b', padding: '3px 6px', borderRadius: '6px', border: '1px solid #27272a' }}>
      <button className="btn-icon" onClick={handleZoomOut} title="Zoom Out (Ctrl -)">
        <ZoomOut size={14} />
      </button>

      <span className="font-mono" style={{ fontSize: '11px', minWidth: '45px', textAlign: 'center', color: '#d4d4d8' }}>
        {Math.round(viewport.zoom * 100)}%
      </span>

      <button className="btn-icon" onClick={handleZoomIn} title="Zoom In (Ctrl +)">
        <ZoomIn size={14} />
      </button>

      <div style={{ width: '1px', height: '14px', backgroundColor: '#27272a', margin: '0 2px' }} />

      <button className="btn-icon" onClick={handleFitToScreen} title="Fit Media to Screen">
        <Maximize2 size={13} />
      </button>

      <button className="btn-icon" onClick={resetViewport} title="Reset Pan & Zoom">
        <RotateCcw size={13} />
      </button>
    </div>
  );
};
