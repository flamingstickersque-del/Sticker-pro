import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Wand2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { BackgroundRemovalModal } from '../Modals/BackgroundRemovalModal';

export const FloatingCanvasControls: React.FC = () => {
  const { viewport, setViewport, artworkList, selectedArtworkId, updateArtwork } = useProjectStore();
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);

  const selectedAsset = artworkList.find((a) => a.id === selectedArtworkId) || artworkList[0];

  return (
    <>
      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        backgroundColor: 'rgba(24, 24, 27, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #27272a',
        borderRadius: '8px',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        zIndex: 20,
      }}>
        {selectedAsset && (
          <>
            <button
              onClick={() => setIsBgModalOpen(true)}
              title="Remove Background on Selected Artwork"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid rgba(236, 72, 153, 0.35)',
                backgroundColor: 'rgba(236, 72, 153, 0.12)',
                color: '#ec4899',
                cursor: 'pointer',
              }}
            >
              <Wand2 size={13} />
              <span>Remove BG</span>
            </button>
            <div style={{ width: '1px', height: '14px', backgroundColor: '#3f3f46' }} />
          </>
        )}

        <div style={{
          padding: '0 8px',
          fontSize: '11px',
          color: '#a1a1aa',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 600,
        }}>
          {Math.round(viewport.zoom * 100)}%
        </div>

        <div style={{ width: '1px', height: '14px', backgroundColor: '#3f3f46' }} />

        <button
          className="btn-icon"
          onClick={() => {
            const current = useProjectStore.getState().viewport.zoom;
            setViewport({ zoom: Math.max(current / 1.25, 0.1) });
          }}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>

        <button
          className="btn-icon"
          onClick={() => {
            const current = useProjectStore.getState().viewport.zoom;
            setViewport({ zoom: Math.min(current * 1.25, 5.0) });
          }}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>

        <button
          className="btn-icon"
          onClick={() => {
            const media = useProjectStore.getState().mediaConfig;
            const fitZoom = Math.min(1.0, Math.min(650 / (media.widthMm * 2), 550 / (media.heightMm * 2)));
            setViewport({ zoom: Math.max(fitZoom, 0.12), panX: 0, panY: 0 });
          }}
          title="Fit Sheet to Viewport"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {isBgModalOpen && selectedAsset && (
        <BackgroundRemovalModal
          asset={selectedAsset}
          isOpen={isBgModalOpen}
          onClose={() => setIsBgModalOpen(false)}
          onApply={(updates) => {
            updateArtwork(selectedAsset.id, updates);
            setIsBgModalOpen(false);
          }}
        />
      )}
    </>
  );
};
