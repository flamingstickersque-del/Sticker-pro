import React from 'react';
import { Grid, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PHYSICAL_UNITS } from '../../config/constants';

export const NestingConfigStep: React.FC = () => {
  const {
    nestingConfig,
    updateNestingConfig,
    layoutResult,
    unit,
    recalculateNesting,
  } = useProjectStore();

  const isMm = unit === 'mm';
  const conversion = isMm ? 1 : PHYSICAL_UNITS.MM_TO_INCH;
  const unitLabel = isMm ? 'mm' : 'in';

  const displaySpacing = Math.round(nestingConfig.spacingMm * conversion * 10) / 10;

  const handleSpacingChange = (valStr: string) => {
    const val = parseFloat(valStr) || 1;
    const newMm = isMm ? val : val * PHYSICAL_UNITS.INCH_TO_MM;
    updateNestingConfig({ spacingMm: Math.max(0.5, newMm) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Cutline Spacing */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#d4d4d8' }}>Cutline Spacing (Gap):</span>
          <span className="font-mono" style={{ fontSize: '11px', color: '#ec4899', fontWeight: 600 }}>
            {displaySpacing} {unitLabel}
          </span>
        </div>
        <input
          type="range"
          min={isMm ? 1 : 0.05}
          max={isMm ? 25 : 1.0}
          step={isMm ? 0.5 : 0.02}
          value={displaySpacing}
          onChange={(e) => handleSpacingChange(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#71717a', marginTop: '2px' }}>
          <span>Tight ({isMm ? '1 mm' : '0.05"'})</span>
          <span>Wide ({isMm ? '25 mm' : '1.0"'})</span>
        </div>
      </div>

      {/* Rotation Optimization */}
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        cursor: 'pointer',
        backgroundColor: '#18181b',
        padding: '8px 10px',
        borderRadius: '6px',
        border: '1px solid #27272a',
      }}>
        <input
          type="checkbox"
          checked={nestingConfig.allow90Rotation}
          onChange={(e) => updateNestingConfig({ allow90Rotation: e.target.checked })}
          style={{ accentColor: '#ec4899' }}
        />
        <div>
          <div style={{ color: '#f4f4f5', fontWeight: 500 }}>Allow 90° Smart Rotation</div>
          <div style={{ fontSize: '10px', color: '#71717a' }}>Rotates stickers to pack tighter and maximize yield</div>
        </div>
      </label>

      {/* Overflow Warning */}
      {layoutResult.unplacedCount > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '8px 10px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#f59e0b',
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Sheet Capacity Exceeded</strong>
            <div style={{ marginTop: '2px', color: '#d4d4d8' }}>
              Only <strong>{layoutResult.placedCount}</strong> of <strong>{layoutResult.totalRequested}</strong> stickers fit within margins. Reduce spacing or increase media size.
            </div>
          </div>
        </div>
      )}

      {/* Re-Nest Action */}
      <button
        type="button"
        className="btn-secondary"
        onClick={recalculateNesting}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <RefreshCw size={13} />
        <span>Re-Pack & Nest Sheet</span>
      </button>
    </div>
  );
};
