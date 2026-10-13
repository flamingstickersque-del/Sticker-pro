/**
 * REGISTRATION MARKS GENERATOR
 * Multi-Cutter & Multi-Printer Production Mark Generation:
 * - Graphtec FC8600 / FC9000 (Type 1 & Type 2 L-Marks + Intermediate Segment Marks + DataLink Barcode)
 * - Roland VersaSTUDIO BN-20 / BN-20A (VersaWorks Quad Alignment Circle & Crop Marks)
 * - SummaCut / S-Class (OPOS Solid Square Corner Targets)
 * - Mimaki FineCut (Corner Crop Brackets)
 * - Standard Optical Crosshairs
 */

import { CUTTER_DEFAULTS } from '../config/constants';
import { MediaConfig, RegistrationConfig, RegistrationMarkInstance } from '../types';

export function calculateRegistrationMarks(
  media: MediaConfig,
  regConfig: RegistrationConfig
): RegistrationMarkInstance[] {
  if (!regConfig.enabled) {
    return [];
  }

  const markSize = regConfig.markSizeMm || CUTTER_DEFAULTS.MARK_SIZE_MM;
  const margins = media.marginsMm;
  const style = regConfig.markStyle || 'graphtec_type1';

  const leftX = margins.left;
  const rightX = media.widthMm - margins.right;
  const topY = margins.top;
  const bottomY = media.heightMm - margins.bottom;

  if (rightX <= leftX || bottomY <= topY) {
    return [];
  }

  const marks: RegistrationMarkInstance[] = [];

  switch (style) {
    case 'roland_quad_crop': {
      // Roland BN-20 VersaWorks Quad Alignment Marks:
      // A circle with centered crosshair and corner crop lines
      const radius = Math.min(markSize / 2, 5.0);
      const arm = markSize;

      // 4 Corners: TL, TR, BL, BR
      const corners: Array<{ id: string; type: RegistrationMarkInstance['type']; x: number; y: number }> = [
        { id: 'roland_mark_tl', type: 'top-left', x: leftX, y: topY },
        { id: 'roland_mark_tr', type: 'top-right', x: rightX, y: topY },
        { id: 'roland_mark_bl', type: 'bottom-left', x: leftX, y: bottomY },
        { id: 'roland_mark_br', type: 'bottom-right', x: rightX, y: bottomY },
      ];

      for (const c of corners) {
        marks.push({
          id: c.id,
          type: c.type,
          xMm: c.x,
          yMm: c.y,
          sizeMm: markSize,
          lines: [
            // Horizontal crosshair through center
            { x1: c.x - arm, y1: c.y, x2: c.x + arm, y2: c.y },
            // Vertical crosshair through center
            { x1: c.x, y1: c.y - arm, x2: c.x, y2: c.y + arm },
          ],
          circles: [
            { cx: c.x, cy: c.y, r: radius, filled: false },
            { cx: c.x, cy: c.y, r: 0.8, filled: true }, // Center pinpoint
          ],
        });
      }
      break;
    }

    case 'summa_opos': {
      // Summa OPOS Alignment System:
      // Solid 3mm black square targets positioned at four corners with lead-in lines
      const sq = Math.min(markSize, 4.0);
      const corners: Array<{ id: string; type: RegistrationMarkInstance['type']; x: number; y: number }> = [
        { id: 'summa_opos_tl', type: 'top-left', x: leftX, y: topY },
        { id: 'summa_opos_tr', type: 'top-right', x: rightX - sq, y: topY },
        { id: 'summa_opos_bl', type: 'bottom-left', x: leftX, y: bottomY - sq },
        { id: 'summa_opos_br', type: 'bottom-right', x: rightX - sq, y: bottomY - sq },
      ];

      for (const c of corners) {
        marks.push({
          id: c.id,
          type: c.type,
          xMm: c.x,
          yMm: c.y,
          sizeMm: sq,
          lines: [],
          rects: [
            { x: c.x, y: c.y, w: sq, h: sq, filled: true },
          ],
        });
      }
      break;
    }

    case 'graphtec_type1': {
      // Graphtec Type 1 (4-point Corner Marks + Intermediate Segment Marks)
      // Standard for Cutting Master 5 and FC9000/FC8600
      // Top-Left corner bracket
      marks.push({
        id: 'graphtec_t1_tl',
        type: 'top-left',
        xMm: leftX,
        yMm: topY,
        sizeMm: markSize,
        lines: [
          { x1: leftX, y1: topY, x2: leftX + markSize, y2: topY },
          { x1: leftX, y1: topY, x2: leftX, y2: topY + markSize },
        ],
      });

      // Top-Right corner bracket
      marks.push({
        id: 'graphtec_t1_tr',
        type: 'top-right',
        xMm: rightX,
        yMm: topY,
        sizeMm: markSize,
        lines: [
          { x1: rightX - markSize, y1: topY, x2: rightX, y2: topY },
          { x1: rightX, y1: topY, x2: rightX, y2: topY + markSize },
        ],
      });

      // Bottom-Left corner bracket
      marks.push({
        id: 'graphtec_t1_bl',
        type: 'bottom-left',
        xMm: leftX,
        yMm: bottomY,
        sizeMm: markSize,
        lines: [
          { x1: leftX, y1: bottomY, x2: leftX + markSize, y2: bottomY },
          { x1: leftX, y1: bottomY - markSize, x2: leftX, y2: bottomY },
        ],
      });

      // Bottom-Right corner bracket
      marks.push({
        id: 'graphtec_t1_br',
        type: 'bottom-right',
        xMm: rightX,
        yMm: bottomY,
        sizeMm: markSize,
        lines: [
          { x1: rightX - markSize, y1: bottomY, x2: rightX, y2: bottomY },
          { x1: rightX, y1: bottomY - markSize, x2: rightX, y2: bottomY },
        ],
      });

      // Intermediate Segment Marks for long roll feeds (e.g. roll feed > 500mm)
      if (regConfig.intermediateMarks) {
        const interval = regConfig.intermediateIntervalMm || 500;
        const totalHeight = bottomY - topY;
        const numSegments = Math.floor(totalHeight / interval);

        for (let seg = 1; seg <= numSegments; seg++) {
          const segY = topY + (totalHeight * seg) / (numSegments + 1);
          // Left intermediate tick
          marks.push({
            id: `graphtec_t1_mid_l_${seg}`,
            type: 'intermediate-left',
            xMm: leftX,
            yMm: segY,
            sizeMm: markSize * 0.7,
            lines: [
              { x1: leftX, y1: segY, x2: leftX + markSize * 0.7, y2: segY },
            ],
          });
          // Right intermediate tick
          marks.push({
            id: `graphtec_t1_mid_r_${seg}`,
            type: 'intermediate-right',
            xMm: rightX,
            yMm: segY,
            sizeMm: markSize * 0.7,
            lines: [
              { x1: rightX - markSize * 0.7, y1: segY, x2: rightX, y2: segY },
            ],
          });
        }
      }

      // Graphtec FC9000 DataLink Barcode (rendered in bottom margin for automated optical job loading)
      if (regConfig.barcodeEnabled && regConfig.barcodeJobId) {
        const barcodeCenterY = bottomY + 10;
        const barcodeCenterX = (leftX + rightX) / 2;
        const barHeight = 8;
        const barLines = generateSimpleBarcodeLines(
          regConfig.barcodeJobId,
          barcodeCenterX,
          barcodeCenterY,
          barHeight
        );

        marks.push({
          id: 'graphtec_datalink_barcode',
          type: 'barcode',
          xMm: barcodeCenterX,
          yMm: barcodeCenterY,
          sizeMm: barHeight,
          lines: barLines,
        });
      }
      break;
    }

    case 'graphtec_type2':
    default: {
      // Graphtec Type 2 (Standard L-marks)
      marks.push(
        {
          id: 'reg_mark_tl',
          type: 'top-left',
          xMm: leftX,
          yMm: topY,
          sizeMm: markSize,
          lines: [
            { x1: leftX, y1: topY, x2: leftX + markSize, y2: topY },
            { x1: leftX, y1: topY, x2: leftX, y2: topY + markSize },
          ],
        },
        {
          id: 'reg_mark_tr',
          type: 'top-right',
          xMm: rightX,
          yMm: topY,
          sizeMm: markSize,
          lines: [
            { x1: rightX, y1: topY, x2: rightX - markSize, y2: topY },
            { x1: rightX, y1: topY, x2: rightX, y2: topY + markSize },
          ],
        },
        {
          id: 'reg_mark_bl',
          type: 'bottom-left',
          xMm: leftX,
          yMm: bottomY,
          sizeMm: markSize,
          lines: [
            { x1: leftX, y1: bottomY, x2: leftX + markSize, y2: bottomY },
            { x1: leftX, y1: bottomY, x2: leftX, y2: bottomY - markSize },
          ],
        },
        {
          id: 'reg_mark_br',
          type: 'bottom-right',
          xMm: rightX,
          yMm: bottomY,
          sizeMm: markSize,
          lines: [
            { x1: rightX, y1: bottomY, x2: rightX - markSize, y2: bottomY },
            { x1: rightX, y1: bottomY, x2: rightX, y2: bottomY - markSize },
          ],
        }
      );
      break;
    }
  }

  return marks;
}

/**
 * Generates clean 1D barcode tick marks for Graphtec FC9000 DataLink reader
 */
function generateSimpleBarcodeLines(
  code: string,
  centerX: number,
  centerY: number,
  barHeight: number
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const barSpacing = 1.2;
  const numBars = Math.min(Math.max(code.length * 5, 25), 45);
  const startX = centerX - (numBars * barSpacing) / 2;

  // Generate pseudo-code 39 pattern for optical reader registration
  for (let i = 0; i < numBars; i++) {
    // Variable thickness pattern based on code hash
    const charCode = code.charCodeAt(i % code.length) || 65;
    const isThick = ((charCode + i * 7) % 3) === 0;
    const x = startX + i * barSpacing;
    lines.push({
      x1: x,
      y1: centerY - barHeight / 2,
      x2: x,
      y2: centerY + barHeight / 2,
    });
    if (isThick) {
      lines.push({
        x1: x + 0.4,
        y1: centerY - barHeight / 2,
        x2: x + 0.4,
        y2: centerY + barHeight / 2,
      });
    }
  }

  return lines;
}
