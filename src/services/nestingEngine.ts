/**
 * 2D NESTING & AUTO-ARRANGEMENT ENGINE
 * 
 * Computes optimal sheet placement for stickers, respecting margins,
 * cut spacing, Graphtec registration safety buffers, and 90° rotation.
 * 
 * Key Enhancements:
 * - Total Size Measurement: Ensures that user-specified dimensions (e.g. 3 inches)
 *   strictly define the final outer cut line boundary (inclusive of bleed/offset),
 *   scaling the inner graphic appropriately.
 * - Auto-Adjusting Media Dimensions: Automatically computes the optimal roll length
 *   or sheet height based on total sticker quantity, eliminating wasted white space.
 */

import { CUTTER_DEFAULTS } from '../config/constants';
import {
  ArtworkAsset,
  ContourConfig,
  LayoutResult,
  MediaConfig,
  NestingConfig,
  PlacedStickerInstance,
  RegistrationConfig,
  RotationAngle,
  normalizeRotationAngle,
} from '../types';
import { generateContourSvgPath } from './contourEngine';
import { calculateRegistrationMarks } from './registrationMarks';

/**
 * Calculates the exact required roll length / media height to fit all items perfectly
 * with zero excess white space.
 */
export function calculateAutoFitMediaHeight(
  assets: ArtworkAsset[],
  media: MediaConfig,
  nesting: NestingConfig,
  contour: ContourConfig,
  regMarks: RegistrationConfig
): number {
  const regBuffer = regMarks.enabled ? regMarks.markSizeMm + CUTTER_DEFAULTS.REG_MARK_SAFETY_OFFSET_MM : 0;
  const leftBound = media.marginsMm.left + regBuffer;
  const rightBound = media.widthMm - media.marginsMm.right - regBuffer;
  const usableWidth = Math.max(0, rightBound - leftBound);

  if (usableWidth <= 0 || assets.length === 0) {
    return media.heightMm;
  }

  // Calculate items and their cut dimensions
  let currentX = leftBound;
  let currentY = media.marginsMm.top + regBuffer;
  let currentRowHeight = 0;
  let maxBottomY = currentY;
  const spacing = nesting.spacingMm;

  for (const asset of assets) {
    const isInclusive = asset.sizingMode !== 'artwork_only';
    let cutW: number;
    let cutH: number;

    if (isInclusive) {
      cutW = asset.widthMm;
      cutH = asset.heightMm;
    } else {
      const offsetAdd = contour.enabled ? contour.offsetMm * 2 : 0;
      cutW = asset.widthMm + offsetAdd;
      cutH = asset.heightMm + offsetAdd;
    }

    const userRotation = normalizeRotationAngle(asset.rotationDeg ?? 0);
    const isSwapped = userRotation === 90 || userRotation === 270;
    const orientedW = isSwapped ? cutH : cutW;
    const orientedH = isSwapped ? cutW : cutH;

    for (let i = 0; i < asset.quantity; i++) {
      let itemW = orientedW;
      let itemH = orientedH;

      if (nesting.allow90Rotation) {
        const normalFits = currentX + itemW <= rightBound;
        const rotatedFits = currentX + itemH <= rightBound;
        if (!normalFits && rotatedFits) {
          itemW = orientedH;
          itemH = orientedW;
        }
      }

      if (currentX + itemW > rightBound) {
        currentX = leftBound;
        currentY += currentRowHeight + spacing;
        currentRowHeight = 0;
      }

      currentX += itemW + spacing;
      currentRowHeight = Math.max(currentRowHeight, itemH);
      maxBottomY = Math.max(maxBottomY, currentY + itemH);
    }
  }

  // Total required height = bottom-most cut + bottom margin + registration mark safety buffer
  const requiredHeightMm = maxBottomY + media.marginsMm.bottom + regBuffer;
  // Round up to nearest millimeter for clean measurement
  return Math.max(Math.ceil(requiredHeightMm), 100);
}

export function runAutoNesting(
  assets: ArtworkAsset[],
  media: MediaConfig,
  nesting: NestingConfig,
  contour: ContourConfig,
  regMarks: RegistrationConfig
): LayoutResult {
  // If autoFitHeight is enabled, dynamically determine the required media height
  let effectiveMedia = media;
  if (media.autoFitHeight && assets.length > 0) {
    const fittedHeightMm = calculateAutoFitMediaHeight(assets, media, nesting, contour, regMarks);
    effectiveMedia = { ...media, heightMm: fittedHeightMm };
  }

  const regMarkInstances = calculateRegistrationMarks(effectiveMedia, regMarks);

  // Determine the inner printable/cuttable bounds
  const regBuffer = regMarks.enabled ? regMarks.markSizeMm + CUTTER_DEFAULTS.REG_MARK_SAFETY_OFFSET_MM : 0;

  const leftBound = effectiveMedia.marginsMm.left + regBuffer;
  const rightBound = effectiveMedia.widthMm - effectiveMedia.marginsMm.right - regBuffer;
  const topBound = effectiveMedia.marginsMm.top + regBuffer;
  const bottomBound = effectiveMedia.heightMm - effectiveMedia.marginsMm.bottom - regBuffer;

  const usableWidth = Math.max(0, rightBound - leftBound);
  const usableHeight = Math.max(0, bottomBound - topBound);

  const placedInstances: PlacedStickerInstance[] = [];
  let totalRequested = 0;

  // Flatten requested instances from all assets with user rotation awareness
  interface RequestItem {
    artworkId: string;
    index: number;
    rawArtworkW: number;
    rawArtworkH: number;
    rawCutW: number;
    rawCutH: number;
    userRotation: RotationAngle;
    orientedW: number;
    orientedH: number;
    perimeterPoints?: Array<{ x: number; y: number }>;
    smoothing?: number;
  }

  const itemsToPlace: RequestItem[] = [];

  for (const asset of assets) {
    totalRequested += asset.quantity;
    const userRotation = normalizeRotationAngle(asset.rotationDeg ?? 0);
    const isSwapped = userRotation === 90 || userRotation === 270;

    // TOTAL SIZE MEASUREMENT (Cut Line Inclusive):
    // By default (or when sizingMode === 'cut_line_inclusive'):
    // asset.widthMm and asset.heightMm represent the TOTAL FINISHED STICKER SIZE (inclusive of the cutline).
    // The inner artwork is scaled down by 2 * offsetMm so the cutline matches exactly the 3-inch target.
    const isInclusive = asset.sizingMode !== 'artwork_only';
    let rawCutW: number;
    let rawCutH: number;
    let rawArtworkW: number;
    let rawArtworkH: number;

    if (isInclusive) {
      rawCutW = asset.widthMm;
      rawCutH = asset.heightMm;
      const offsetReduction = contour.enabled ? contour.offsetMm * 2 : 0;
      rawArtworkW = Math.max(2, asset.widthMm - offsetReduction);
      rawArtworkH = Math.max(2, asset.heightMm - offsetReduction);
    } else {
      rawArtworkW = asset.widthMm;
      rawArtworkH = asset.heightMm;
      const offsetAddition = contour.enabled ? contour.offsetMm * 2 : 0;
      rawCutW = asset.widthMm + offsetAddition;
      rawCutH = asset.heightMm + offsetAddition;
    }

    // Swap bounding dimensions if rotated by 90° or 270°
    const orientedW = isSwapped ? rawCutH : rawCutW;
    const orientedH = isSwapped ? rawCutW : rawCutH;

    for (let i = 0; i < asset.quantity; i++) {
      itemsToPlace.push({
        artworkId: asset.id,
        index: i,
        rawArtworkW,
        rawArtworkH,
        rawCutW,
        rawCutH,
        userRotation,
        orientedW,
        orientedH,
        perimeterPoints: asset.perimeterPoints,
        smoothing: asset.smoothing !== undefined ? asset.smoothing : contour.smoothing,
      });
    }
  }

  if (usableWidth <= 0 || usableHeight <= 0 || itemsToPlace.length === 0) {
    return {
      placedCount: 0,
      totalRequested,
      unplacedCount: totalRequested,
      sheetUtilizationPercent: 0,
      instances: [],
      registrationMarks: regMarkInstances,
      printableAreaMm: {
        x: leftBound,
        y: topBound,
        width: usableWidth,
        height: usableHeight,
      },
    };
  }

  // 2D Guillotine / Bin-Packing Grid Algorithm
  const spacing = nesting.spacingMm;
  let currentX = leftBound;
  let currentY = topBound;
  let currentRowHeight = 0;

  let totalPlacedArea = 0;

  for (const item of itemsToPlace) {
    let itemW = item.orientedW;
    let itemH = item.orientedH;
    let finalRotation: RotationAngle = item.userRotation;

    // Check if automatic 90 degree rotation is allowed by nesting config
    if (nesting.allow90Rotation) {
      const normalFitsCurrentLine = currentX + itemW <= rightBound;
      const rotatedFitsCurrentLine = currentX + itemH <= rightBound;

      if (!normalFitsCurrentLine && rotatedFitsCurrentLine) {
        // Rotate an additional 90 degrees for optimal packing
        finalRotation = normalizeRotationAngle(finalRotation + 90);
        itemW = item.orientedH;
        itemH = item.orientedW;
      }
    }

    // Check if item exceeds current row width
    if (currentX + itemW > rightBound) {
      // Advance to next row
      currentX = leftBound;
      currentY += currentRowHeight + spacing;
      currentRowHeight = 0;
    }

    // Check if item exceeds vertical sheet boundary
    if (currentY + itemH > bottomBound) {
      // Sheet is full, cannot place further items
      break;
    }

    // Place item (center-anchored)
    const centerX = currentX + itemW / 2;
    const centerY = currentY + itemH / 2;

    // The contour path is generated for the raw unrotated artwork dimensions.
    // The render transform pipeline will rotate this path by finalRotation.
    const itemContour: ContourConfig = item.smoothing !== undefined
      ? { ...contour, smoothing: item.smoothing }
      : contour;

    const contourPath = generateContourSvgPath(
      item.rawArtworkW,
      item.rawArtworkH,
      itemContour,
      item.perimeterPoints
    );

    placedInstances.push({
      instanceId: `inst_${item.artworkId}_${item.index}`,
      artworkId: item.artworkId,
      index: item.index,
      xMm: centerX,
      yMm: centerY,
      widthMm: itemW,
      heightMm: itemH,
      rawWidthMm: item.rawArtworkW,
      rawHeightMm: item.rawArtworkH,
      rotationDeg: finalRotation,
      contourPath,
    });

    totalPlacedArea += itemW * itemH;
    currentX += itemW + spacing;
    currentRowHeight = Math.max(currentRowHeight, itemH);
  }

  const placedCount = placedInstances.length;
  const unplacedCount = Math.max(0, totalRequested - placedCount);
  const totalSheetArea = effectiveMedia.widthMm * effectiveMedia.heightMm;
  const sheetUtilizationPercent = totalSheetArea > 0
    ? Math.min(100, Math.round((totalPlacedArea / totalSheetArea) * 1000) / 10)
    : 0;

  return {
    placedCount,
    totalRequested,
    unplacedCount,
    sheetUtilizationPercent,
    instances: placedInstances,
    registrationMarks: regMarkInstances,
    printableAreaMm: {
      x: leftBound,
      y: topBound,
      width: usableWidth,
      height: usableHeight,
    },
  };
}
