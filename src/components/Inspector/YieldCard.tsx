import React from 'react';
import { PieChart, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PHYSICAL_UNITS } from '../../config/constants';

export const YieldCard: React.FC = () => {
  const {
    layoutResult,
    mediaConfig,
    contourConfig,
    nestingConfig,
    artworkList,
    selectedArtworkId,
    unit,
  } = useProjectStore();

  const isMm = unit === 'mm';
  const conversion = isMm ? 1 : PHYSICAL_UNITS.MM_TO_INCH;
  const unitLabel = isMm ? 'mm' : 'in';

  const selectedAsset = artworkList.find((a) => a.id === selectedArtworkId) || artworkList[0];

  const utilization = layoutResult.sheetUtilizationPercent;
  const isOptimal = utilization >= 65;

  return (
    <div style={{
      backgroundColor: '#18181b',
      borderRadius: '8px',
      border: '1px solid #27272a',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: '#141417',
      }}>
        <PieChart size={14} color="#f59e0b" />
        <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Production Yield & Summary
        </h3>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Utilization Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Material Utilization:</span>
            <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: isOptimal ? '#10b981' : '#f59e0b' }}>
              {utilization}%
            </span>
          </div>

          <div style={{ height: '6px', backgroundColor: '#27272a', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(utilization, 100)}%`,
                backgroundColor: isOptimal ? '#10b981' : '#f59e0b',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Breakdown table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#71717a' }}>Placed Count:</span>
            <span className="font-mono" style={{ fontWeight: 600, color: '#f4f4f5' }}>
              {layoutResult.placedCount} / {layoutResult.totalRequested} pcs
            </span>
          </div>

          {selectedAsset && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#71717a' }}>Sticker Size:</span>
              <span className="font-mono" style={{ color: '#d4d4d8' }}>
                {Math.round(selectedAsset.widthMm * conversion * 10) / 10} × {Math.round(selectedAsset.heightMm * conversion * 10) / 10} {unitLabel}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#71717a' }}>Media Size:</span>
            <span className="font-mono" style={{ color: '#d4d4d8' }}>
              {Math.round(mediaConfig.widthMm * conversion * 10) / 10} × {Math.round(mediaConfig.heightMm * conversion * 10) / 10} {unitLabel}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#71717a' }}>Spacing:</span>
            <span className="font-mono" style={{ color: '#d4d4d8' }}>
              {Math.round(nestingConfig.spacingMm * conversion * 10) / 10} {unitLabel}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#71717a' }}>Cutline Offset:</span>
            <span className="font-mono" style={{ color: '#ec4899' }}>
              {Math.round(contourConfig.offsetMm * conversion * 10) / 10} {unitLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
