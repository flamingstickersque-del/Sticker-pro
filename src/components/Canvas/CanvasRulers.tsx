import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { PHYSICAL_UNITS } from '../../config/constants';

interface CanvasRulersProps {
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const CanvasRulers: React.FC<CanvasRulersProps> = ({
  canvasWidth,
  canvasHeight,
  scale,
  offsetX,
  offsetY,
}) => {
  const { unit, mediaConfig } = useProjectStore();

  const isMm = unit === 'mm';
  const unitLabel = isMm ? 'mm' : 'in';

  // Major step (50mm or 2in)
  const stepMm = isMm ? 50 : 2 * PHYSICAL_UNITS.INCH_TO_MM;
  const stepPx = stepMm * scale;

  // Dynamically compute tick count to cover entire sheet up to 59" / 120"
  const maxDimMm = Math.max(mediaConfig.widthMm, mediaConfig.heightMm, 3200);
  const tickCount = Math.ceil(maxDimMm / stepMm) + 10;

  return (
    <>
      {/* Top Ruler */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '24px',
        right: 0,
        height: '24px',
        backgroundColor: '#18181b',
        borderBottom: '1px solid #27272a',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {Array.from({ length: tickCount }).map((_, i) => {
            const mmVal = i * stepMm;
            const xPos = offsetX + mmVal * scale;
            if (xPos < -50 || xPos > canvasWidth + 50) return null;

            const displayVal = isMm ? mmVal : Math.round((mmVal * PHYSICAL_UNITS.MM_TO_INCH) * 10) / 10;

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${xPos}px`,
                  bottom: 0,
                  height: '10px',
                  borderLeft: '1px solid #3f3f46',
                  paddingLeft: '3px',
                  fontSize: '9px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#71717a',
                }}
              >
                {displayVal}
              </div>
            );
          })}
        </div>
      </div>

      {/* Left Ruler */}
      <div style={{
        position: 'absolute',
        top: '24px',
        left: 0,
        bottom: 0,
        width: '24px',
        backgroundColor: '#18181b',
        borderRight: '1px solid #27272a',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {Array.from({ length: tickCount }).map((_, i) => {
            const mmVal = i * stepMm;
            const yPos = offsetY + mmVal * scale;
            if (yPos < -50 || yPos > canvasHeight + 50) return null;

            const displayVal = isMm ? mmVal : Math.round((mmVal * PHYSICAL_UNITS.MM_TO_INCH) * 10) / 10;

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: `${yPos}px`,
                  right: 0,
                  width: '10px',
                  borderTop: '1px solid #3f3f46',
                  fontSize: '9px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: '#71717a',
                  textAlign: 'right',
                  paddingRight: '3px',
                  transform: 'translateY(-50%)',
                }}
              >
                {displayVal}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-Left Corner Unit Box */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '24px',
        height: '24px',
        backgroundColor: '#141417',
        borderRight: '1px solid #27272a',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        fontWeight: 700,
        color: '#a1a1aa',
        fontFamily: 'JetBrains Mono, monospace',
        zIndex: 15,
      }}>
        {unitLabel}
      </div>
    </>
  );
};
