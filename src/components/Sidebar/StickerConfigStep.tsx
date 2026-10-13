import React, { useState } from 'react';
import { RotateCw, Link as LinkIcon, Unlink, Wand2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PHYSICAL_UNITS } from '../../config/constants';
import { normalizeRotationAngle } from '../../types';
import { BackgroundRemovalModal } from '../Modals/BackgroundRemovalModal';

export const StickerConfigStep: React.FC = () => {
  const {
    artworkList,
    selectedArtworkId,
    updateArtwork,
    contourConfig,
    mediaConfig,
    unit,
  } = useProjectStore();

  const [isBgModalOpen, setIsBgModalOpen] = useState(false);

  const selectedAsset = artworkList.find((a) => a.id === selectedArtworkId) || artworkList[0];

  if (!selectedAsset) {
    return (
      <div style={{ padding: '16px 0', color: '#71717a', fontSize: '12px', textAlign: 'center' }}>
        No artwork selected. Upload artwork to configure sticker dimensions.
      </div>
    );
  }

  const isMm = unit === 'mm';
  const conversion = isMm ? 1 : PHYSICAL_UNITS.MM_TO_INCH;
  const unitLabel = isMm ? 'mm' : 'in';

  const isInclusive = selectedAsset.sizingMode !== 'artwork_only';
  const displayWidth = Math.round(selectedAsset.widthMm * conversion * 100) / 100;
  const displayHeight = Math.round(selectedAsset.heightMm * conversion * 100) / 100;

  // Compute inner artwork dimensions when in cut-line inclusive mode
  const offsetMm = contourConfig.enabled ? contourConfig.offsetMm : 0;
  const innerArtworkWMm = isInclusive ? Math.max(2, selectedAsset.widthMm - offsetMm * 2) : selectedAsset.widthMm;
  const innerArtworkHMm = isInclusive ? Math.max(2, selectedAsset.heightMm - offsetMm * 2) : selectedAsset.heightMm;
  const displayInnerW = Math.round(innerArtworkWMm * conversion * 100) / 100;
  const displayInnerH = Math.round(innerArtworkHMm * conversion * 100) / 100;

  const handleWidthChange = (valStr: string) => {
    const val = parseFloat(valStr) || 0;
    const newWidthMm = isMm ? val : val * PHYSICAL_UNITS.INCH_TO_MM;
    const newHeightMm = selectedAsset.aspectRatio > 0 ? newWidthMm / selectedAsset.aspectRatio : selectedAsset.heightMm;
    
    // Recalculate effective DPI = pixels / (mm / 25.4)
    const effDpi = selectedAsset.originalWidthPx / (newWidthMm / 25.4);

    updateArtwork(selectedAsset.id, {
      widthMm: Math.round(newWidthMm * 10) / 10,
      heightMm: Math.round(newHeightMm * 10) / 10,
      effectiveDpi: Math.round(effDpi),
    });
  };

  const handleHeightChange = (valStr: string) => {
    const val = parseFloat(valStr) || 0;
    const newHeightMm = isMm ? val : val * PHYSICAL_UNITS.INCH_TO_MM;
    const newWidthMm = selectedAsset.aspectRatio > 0 ? newHeightMm * selectedAsset.aspectRatio : selectedAsset.widthMm;
    
    const effDpi = selectedAsset.originalWidthPx / (newWidthMm / 25.4);

    updateArtwork(selectedAsset.id, {
      widthMm: Math.round(newWidthMm * 10) / 10,
      heightMm: Math.round(newHeightMm * 10) / 10,
      effectiveDpi: Math.round(effDpi),
    });
  };

  const handleSetPresetSize = (targetInches: number) => {
    const targetMm = targetInches * PHYSICAL_UNITS.INCH_TO_MM;
    const targetHeightMm = selectedAsset.aspectRatio > 0 ? targetMm / selectedAsset.aspectRatio : targetMm;
    const effDpi = selectedAsset.originalWidthPx / (targetMm / 25.4);

    updateArtwork(selectedAsset.id, {
      widthMm: Math.round(targetMm * 10) / 10,
      heightMm: Math.round(targetHeightMm * 10) / 10,
      effectiveDpi: Math.round(effDpi),
    });
  };

  const handleQuantityChange = (qty: number) => {
    updateArtwork(selectedAsset.id, { quantity: Math.max(1, qty) });
  };

  const handleRotationChange = (val: number) => {
    const validAngle = normalizeRotationAngle(val);
    updateArtwork(selectedAsset.id, { rotationDeg: validAngle });
  };

  const toggleSizingMode = (mode: 'cut_line_inclusive' | 'artwork_only') => {
    updateArtwork(selectedAsset.id, { sizingMode: mode });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Sizing Mode Definition */}
      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
          Sizing Standard (Cut Line vs Image)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            type="button"
            onClick={() => toggleSizingMode('cut_line_inclusive')}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              border: isInclusive ? '1px solid #ec4899' : '1px solid #27272a',
              backgroundColor: isInclusive ? 'rgba(236, 72, 153, 0.15)' : '#18181b',
              color: isInclusive ? '#f43f5e' : '#a1a1aa',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            <div>Total Cut Size (3")</div>
            <div style={{ fontSize: '9px', fontWeight: 400, opacity: 0.8 }}>(Includes Cut Line)</div>
          </button>
          <button
            type="button"
            onClick={() => toggleSizingMode('artwork_only')}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              border: !isInclusive ? '1px solid #ec4899' : '1px solid #27272a',
              backgroundColor: !isInclusive ? 'rgba(236, 72, 153, 0.15)' : '#18181b',
              color: !isInclusive ? '#f43f5e' : '#a1a1aa',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            <div>Artwork Only</div>
            <div style={{ fontSize: '9px', fontWeight: 400, opacity: 0.8 }}>(Adds bleed outward)</div>
          </button>
        </div>
      </div>

      {/* Quick Standard Presets */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', color: '#71717a' }}>Quick Standard Presets:</span>
          <span style={{ fontSize: '9.5px', color: '#ec4899', fontWeight: 600 }}>Standard 3.0" Cut Line</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[2, 2.5, 3, 4].map((sizeIn) => {
            const isCurrent = Math.abs(selectedAsset.widthMm - sizeIn * 25.4) < 0.6;
            const isStandard3 = sizeIn === 3;
            return (
              <button
                key={sizeIn}
                type="button"
                onClick={() => handleSetPresetSize(sizeIn)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  fontSize: '10px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  border: isCurrent
                    ? '1px solid #ec4899'
                    : isStandard3
                    ? '1px solid rgba(236, 72, 153, 0.55)'
                    : '1px solid #27272a',
                  backgroundColor: isCurrent
                    ? 'rgba(236, 72, 153, 0.2)'
                    : isStandard3
                    ? 'rgba(236, 72, 153, 0.08)'
                    : '#18181b',
                  color: isCurrent ? '#ec4899' : isStandard3 ? '#f472b6' : '#d4d4d8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ec4899')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = isCurrent ? '#ec4899' : isStandard3 ? 'rgba(236, 72, 153, 0.55)' : '#27272a')}
              >
                {sizeIn}" {isStandard3 ? '★' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Physical Dimensions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase' }}>
            {isInclusive ? `Outer Cut Line Dimension (${unitLabel})` : `Artwork Dimension (${unitLabel})`}
          </label>
          <span style={{ fontSize: '10px', color: '#71717a' }}>Proportional</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#71717a', marginBottom: '2px' }}>Width</div>
            <input
              type="number"
              step={isMm ? '1' : '0.1'}
              min="5"
              className="studio-input"
              value={displayWidth}
              onChange={(e) => handleWidthChange(e.target.value)}
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#71717a', marginBottom: '2px' }}>Height</div>
            <input
              type="number"
              step={isMm ? '1' : '0.1'}
              min="5"
              className="studio-input"
              value={displayHeight}
              onChange={(e) => handleHeightChange(e.target.value)}
            />
          </div>
        </div>

        {/* Real-time dimension breakout */}
        <div style={{
          marginTop: '6px',
          padding: '6px 8px',
          backgroundColor: '#18181b',
          borderRadius: '4px',
          border: '1px solid #27272a',
          fontSize: '10px',
          color: '#a1a1aa',
          lineHeight: '1.4',
        }}>
          {isInclusive ? (
            <div>
              <strong style={{ color: '#10b981' }}>Total Cut Dimension:</strong> {displayWidth} × {displayHeight} {unitLabel} (3.00 in)
              <br />
              <span style={{ color: '#71717a' }}>
                Inner Graphic: {displayInnerW} × {displayInnerH} {unitLabel} (with {Math.round(offsetMm * conversion * 100) / 100} {unitLabel} cut offset)
              </span>
            </div>
          ) : (
            <div>
              <strong style={{ color: '#f59e0b' }}>Inner Graphic:</strong> {displayWidth} × {displayHeight} {unitLabel}
              <br />
              <span style={{ color: '#71717a' }}>
                Final Cut Line: {Math.round((selectedAsset.widthMm + offsetMm * 2) * conversion * 100) / 100} × {Math.round((selectedAsset.heightMm + offsetMm * 2) * conversion * 100) / 100} {unitLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quantity & Rotation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            Quantity (Pcs)
          </label>
          <input
            type="number"
            min="1"
            max="5000"
            className="studio-input"
            value={selectedAsset.quantity}
            onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
          />
        </div>

        <div>
          <label
            htmlFor="sticker-rotation-input"
            style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}
          >
            Rotation
          </label>
          <select
            id="sticker-rotation-input"
            className="studio-input"
            value={selectedAsset.rotationDeg}
            onChange={(e) => handleRotationChange(Number(e.target.value))}
            style={{ cursor: 'pointer' }}
          >
            <option value={0}>0° (Standard)</option>
            <option value={90}>90° (Clockwise)</option>
            <option value={180}>180° (Inverted)</option>
            <option value={270}>270° (Counter-CW)</option>
          </select>
        </div>
      </div>

      {/* Quick Quantity Buttons & Auto-Adjust Badge */}
      <div>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          {[12, 50, 100, 200, 500].map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => handleQuantityChange(qty)}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: '10px',
                fontWeight: 600,
                borderRadius: '4px',
                border: selectedAsset.quantity === qty ? '1px solid #10b981' : '1px solid #27272a',
                backgroundColor: selectedAsset.quantity === qty ? 'rgba(16, 185, 129, 0.15)' : '#18181b',
                color: selectedAsset.quantity === qty ? '#10b981' : '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {qty} pcs
            </button>
          ))}
        </div>
        <div style={{
          fontSize: '9.5px',
          color: mediaConfig.autoFitHeight ? '#10b981' : '#a1a1aa',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 0',
        }}>
          <span>⚡ Auto-Adjust Media Dimensions: <strong>{mediaConfig.autoFitHeight ? 'Active (Sheet automatically resizes to fit quantity)' : 'Manual (Fixed Length)'}</strong></span>
        </div>
      </div>

      {/* Quick Angle Selector Buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {([0, 90, 180, 270] as const).map((angle) => {
          const isActive = selectedAsset.rotationDeg === angle;
          return (
            <button
              key={angle}
              type="button"
              onClick={() => handleRotationChange(angle)}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '4px',
                border: isActive ? '1px solid #ec4899' : '1px solid #27272a',
                backgroundColor: isActive ? 'rgba(236, 72, 153, 0.15)' : '#18181b',
                color: isActive ? '#ec4899' : '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {angle}°
            </button>
          );
        })}
      </div>

      {/* Effective Print DPI Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        backgroundColor: '#18181b',
        borderRadius: '6px',
        border: '1px solid #27272a',
        fontSize: '11px',
      }}>
        <span style={{ color: '#a1a1aa' }}>Effective Print Resolution:</span>
        <span className="font-mono" style={{
          fontWeight: 600,
          color: selectedAsset.effectiveDpi >= 240 ? '#10b981' : selectedAsset.effectiveDpi >= 150 ? '#f59e0b' : '#ef4444',
        }}>
          {selectedAsset.effectiveDpi} DPI
        </span>
      </div>

      {/* Remove Background Quick Action */}
      <button
        type="button"
        onClick={() => setIsBgModalOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: 'rgba(236, 72, 153, 0.12)',
          border: '1px solid rgba(236, 72, 153, 0.35)',
          color: '#ec4899',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Wand2 size={13} />
        <span>Remove Background & Tighten Cutline</span>
      </button>

      {isBgModalOpen && (
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
    </div>
  );
};
