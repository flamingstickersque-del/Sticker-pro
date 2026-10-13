import React from 'react';
import { Layers, RotateCcw } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { MEDIA_PRESETS, PHYSICAL_UNITS, VALIDATION_LIMITS } from '../../config/constants';

export const MediaConfigStep: React.FC = () => {
  const {
    mediaConfig,
    updateMediaConfig,
    autoFitMediaDimensions,
    layoutResult,
    artworkList,
    unit,
  } = useProjectStore();

  const isMm = unit === 'mm';
  const conversion = isMm ? 1 : PHYSICAL_UNITS.MM_TO_INCH;
  const unitLabel = isMm ? 'mm' : 'in';

  const totalQuantity = artworkList.reduce((acc, a) => acc + a.quantity, 0);
  const displayWidth = Math.round(mediaConfig.widthMm * conversion * 10) / 10;
  const displayHeight = Math.round(mediaConfig.heightMm * conversion * 10) / 10;

  const handlePresetSelect = (presetId: string) => {
    if (presetId === 'custom') {
      updateMediaConfig({ presetId: 'custom' });
      return;
    }
    const preset = MEDIA_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    updateMediaConfig({
      presetId,
      type: preset.type,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
    });
  };

  const toggleOrientation = () => {
    updateMediaConfig({
      widthMm: mediaConfig.heightMm,
      heightMm: mediaConfig.widthMm,
      orientation: mediaConfig.orientation === 'portrait' ? 'landscape' : 'portrait',
    });
  };

  const handleWidthChange = (valStr: string) => {
    const rawVal = parseFloat(valStr);
    if (isNaN(rawVal)) return;
    const newW = isMm ? rawVal : rawVal * PHYSICAL_UNITS.INCH_TO_MM;
    const clampedW = Math.min(Math.max(newW, VALIDATION_LIMITS.MIN_SHEET_DIM_MM), VALIDATION_LIMITS.MAX_CUSTOM_SHEET_WIDTH_MM);
    updateMediaConfig({ widthMm: clampedW, presetId: 'custom' });
  };

  const handleHeightChange = (valStr: string) => {
    const rawVal = parseFloat(valStr);
    if (isNaN(rawVal)) return;
    const newH = isMm ? rawVal : rawVal * PHYSICAL_UNITS.INCH_TO_MM;
    const clampedH = Math.min(Math.max(newH, VALIDATION_LIMITS.MIN_SHEET_DIM_MM), VALIDATION_LIMITS.MAX_CUSTOM_SHEET_LENGTH_MM);
    updateMediaConfig({ heightMm: clampedH, presetId: 'custom', autoFitHeight: false });
  };

  const toggleAutoFitHeight = () => {
    const nextVal = !mediaConfig.autoFitHeight;
    updateMediaConfig({ autoFitHeight: nextVal });
    if (nextVal) {
      autoFitMediaDimensions();
    }
  };

  const handleMarginChange = (side: 'top' | 'bottom' | 'left' | 'right', valStr: string) => {
    const val = parseFloat(valStr) || 0;
    const newMm = isMm ? val : val * PHYSICAL_UNITS.INCH_TO_MM;
    updateMediaConfig({
      marginsMm: {
        ...mediaConfig.marginsMm,
        [side]: newMm,
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Preset Selector */}
      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
          Media Substrate Preset
        </label>
        <select
          value={mediaConfig.presetId || 'custom'}
          onChange={(e) => handlePresetSelect(e.target.value)}
          className="studio-input"
          style={{ width: '100%', cursor: 'pointer' }}
        >
          <option value="custom">-- Custom Dimensions --</option>
          {MEDIA_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Auto-Adjusting Media Dimensions Feature */}
      <div style={{
        padding: '10px 12px',
        backgroundColor: mediaConfig.autoFitHeight ? 'rgba(16, 185, 129, 0.08)' : '#18181b',
        border: mediaConfig.autoFitHeight ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #27272a',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: mediaConfig.autoFitHeight ? '#10b981' : '#f4f4f5' }}>
              ⚡ Auto-Adjust Media Dimensions
            </div>
            <div style={{ fontSize: '10px', color: '#71717a' }}>
              Hugs sticker quantity (No wasted roll space)
            </div>
          </div>
          <button
            type="button"
            onClick={toggleAutoFitHeight}
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mediaConfig.autoFitHeight ? '#10b981' : '#27272a',
              color: mediaConfig.autoFitHeight ? '#ffffff' : '#a1a1aa',
              transition: 'all 0.15s ease',
            }}
          >
            {mediaConfig.autoFitHeight ? 'ON' : 'OFF'}
          </button>
        </div>

        <button
          type="button"
          onClick={autoFitMediaDimensions}
          style={{
            width: '100%',
            padding: '6px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            border: '1px solid #3f3f46',
            backgroundColor: '#27272a',
            color: '#f4f4f5',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#10b981')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3f3f46')}
        >
          <span>⚡ Snap Sheet Length to Quantity ({totalQuantity} pcs)</span>
        </button>

        <div style={{ fontSize: '9.5px', color: '#a1a1aa', lineHeight: '1.3' }}>
          Current Sheet Utilization: <strong style={{ color: '#10b981' }}>{layoutResult.sheetUtilizationPercent}%</strong>
          {mediaConfig.autoFitHeight && ' • Canvas height automatically scales to fit 100% of entered stickers.'}
        </div>
      </div>

      {/* Dimensions & Orientation */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#d4d4d8' }}>Media Dimensions ({unitLabel})</span>
          <button
            type="button"
            className="btn-icon"
            onClick={toggleOrientation}
            title="Rotate Sheet Orientation (Portrait / Landscape)"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#71717a', marginBottom: '2px' }}>Width</div>
            <input
              type="number"
              step={isMm ? '5' : '0.5'}
              className="studio-input"
              value={displayWidth}
              onChange={(e) => handleWidthChange(e.target.value)}
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#71717a', marginBottom: '2px' }}>
              Height / Length {mediaConfig.autoFitHeight ? '(Auto-Fit)' : ''}
            </div>
            <input
              type="number"
              step={isMm ? '5' : '0.5'}
              className="studio-input"
              value={displayHeight}
              onChange={(e) => handleHeightChange(e.target.value)}
            />
          </div>
        </div>
        <div style={{ fontSize: '9px', color: '#71717a', marginTop: '4px' }}>
          * Max roll/sheet width: {VALIDATION_LIMITS.MAX_CUSTOM_SHEET_WIDTH_IN}" ({VALIDATION_LIMITS.MAX_CUSTOM_SHEET_WIDTH_MM} mm)
        </div>
      </div>

      {/* Margins */}
      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
          Pinch Roller Safe Margins ({unitLabel})
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#71717a' }}>Top:</span>
            <input
              type="number"
              step={isMm ? '1' : '0.1'}
              className="studio-input"
              value={Math.round(mediaConfig.marginsMm.top * conversion * 10) / 10}
              onChange={(e) => handleMarginChange('top', e.target.value)}
            />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#71717a' }}>Bottom:</span>
            <input
              type="number"
              step={isMm ? '1' : '0.1'}
              className="studio-input"
              value={Math.round(mediaConfig.marginsMm.bottom * conversion * 10) / 10}
              onChange={(e) => handleMarginChange('bottom', e.target.value)}
            />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#71717a' }}>Left:</span>
            <input
              type="number"
              step={isMm ? '1' : '0.1'}
              className="studio-input"
              value={Math.round(mediaConfig.marginsMm.left * conversion * 10) / 10}
              onChange={(e) => handleMarginChange('left', e.target.value)}
            />
          </div>
          <div>
            <span style={{ fontSize: '10px', color: '#71717a' }}>Right:</span>
            <input
              type="number"
              step={isMm ? '1' : '0.1'}
              className="studio-input"
              value={Math.round(mediaConfig.marginsMm.right * conversion * 10) / 10}
              onChange={(e) => handleMarginChange('right', e.target.value)}
            />
          </div>
        </div>
        <div style={{ fontSize: '9px', color: '#71717a', marginTop: '4px' }}>
          * Graphtec FC8600 recommends ≥20mm top / ≥25mm bottom for rear trailing pinch sensor.
        </div>
      </div>
    </div>
  );
};
