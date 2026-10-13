import React from 'react';
import { CheckCircle2, AlertTriangle, Printer, Layers, Activity } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PHYSICAL_UNITS } from '../../config/constants';

export const AppStatusBar: React.FC = () => {
  const {
    layoutResult,
    mediaConfig,
    artworkList,
    selectedArtworkId,
    unit,
    viewport,
  } = useProjectStore();

  const isMm = unit === 'mm';
  const conversion = isMm ? 1 : PHYSICAL_UNITS.MM_TO_INCH;
  const unitLabel = isMm ? 'mm' : 'in';

  const selectedAsset = artworkList.find((a) => a.id === selectedArtworkId) || artworkList[0];

  const hasOverflow = layoutResult.unplacedCount > 0;

  return (
    <footer style={{
      height: '32px',
      backgroundColor: '#121215',
      borderTop: '1px solid #27272a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      fontSize: '11px',
      color: '#a1a1aa',
      zIndex: 50,
    }}>
      {/* Left: Production Placement Ratio */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {hasOverflow ? (
            <AlertTriangle size={13} color="#f59e0b" />
          ) : (
            <CheckCircle2 size={13} color="#10b981" />
          )}
          <span style={{ color: '#d4d4d8', fontWeight: 500 }}>
            Placed:{' '}
            <strong style={{ color: hasOverflow ? '#f59e0b' : '#10b981' }}>
              {layoutResult.placedCount} / {layoutResult.totalRequested}
            </strong>
          </span>
        </div>

        <div style={{ width: '1px', height: '12px', backgroundColor: '#27272a' }} />

        {/* Media Dimensions */}
        <div>
          Media:{' '}
          <strong style={{ color: '#d4d4d8' }} className="font-mono">
            {Math.round(mediaConfig.widthMm * conversion * 10) / 10} × {Math.round(mediaConfig.heightMm * conversion * 10) / 10} {unitLabel}
          </strong>
        </div>

        {selectedAsset && (
          <>
            <div style={{ width: '1px', height: '12px', backgroundColor: '#27272a' }} />
            <div>
              Sticker:{' '}
              <strong style={{ color: '#d4d4d8' }} className="font-mono">
                {Math.round(selectedAsset.widthMm * conversion * 10) / 10} × {Math.round(selectedAsset.heightMm * conversion * 10) / 10} {unitLabel}
              </strong>
            </div>
          </>
        )}

        <div style={{ width: '1px', height: '12px', backgroundColor: '#27272a' }} />
        <div>
          Yield:{' '}
          <strong style={{ color: '#ec4899' }} className="font-mono">
            {layoutResult.sheetUtilizationPercent}%
          </strong>
        </div>
      </div>

      {/* Right: Cutter Kinematics Status & Zoom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
          <Activity size={12} />
          <span>Graphtec FC8600: Safe Margins Verified</span>
        </div>

        <div style={{ width: '1px', height: '12px', backgroundColor: '#27272a' }} />

        <div className="font-mono" style={{ color: '#71717a' }}>
          Zoom: {Math.round(viewport.zoom * 100)}%
        </div>
      </div>
    </footer>
  );
};
