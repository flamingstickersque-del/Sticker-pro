/**
 * TYPESAFE TECHNICAL SUPPORT & WORKFLOW ASSISTANT ENGINE
 * 
 * Evidence-first troubleshooting for Print-and-Cut production:
 * - Analyzes workspace state (layers, cut contours, nesting, media margins, registration marks)
 * - Analyzes exported SVG/PDF files and layer separation
 * - Uses TypeSafe System One judgments (JEV) to reason about user symptoms
 * - Formulates structured diagnostic reports with actionable UI instructions
 */

import { choice, noul, TypeSafeClient } from '@typesafe-ai/sdk';
import {
  ArtworkAsset,
  ContourConfig,
  LayoutResult,
  MediaConfig,
  NestingConfig,
  ProductionLayerState,
  RegistrationConfig,
} from '../types';
import { CUTTER_DEFAULTS, PRODUCTION_LAYERS } from '../config/constants';

let clientInstance: TypeSafeClient | null = null;

function getTypeSafeClient(): TypeSafeClient | null {
  const apiKey = (import.meta as any).env?.VITE_TYPESAFE_API_KEY || '';
  if (!apiKey) return null;
  if (!clientInstance) {
    clientInstance = new TypeSafeClient({ apiKey });
  }
  return clientInstance;
}

export interface WorkspaceEvidence {
  layers: Record<string, ProductionLayerState>;
  layoutResult: LayoutResult;
  mediaConfig: MediaConfig;
  contourConfig: ContourConfig;
  nestingConfig: NestingConfig;
  registrationConfig: RegistrationConfig;
  selectedAsset?: ArtworkAsset;
  totalAssetsCount: number;
}

export interface FileEvidence {
  filename?: string;
  hasArtworkLayer?: boolean;
  hasCutContourLayer?: boolean;
  hasPathLineLayer?: boolean;
  hasRegMarksLayer?: boolean;
  cutContourSpotColor?: string;
  viewBoxMm?: { width: number; height: number };
}

export interface DiagnosticResult {
  issueCategory: string;
  confidenceScore: number;
  whatIFound: string;
  likelyCause: string;
  howToFixIt: string[];
  whyThisHappens: string;
  verification: string;
  autoFixAvailable: boolean;
  autoFixLabel?: string;
  fixActionKey?: 'unhide_artwork' | 'unhide_cut_contour' | 'increase_cut_offset' | 'increase_sheet_size' | 'increase_pinch_margins' | 'enable_reg_marks';
}

/**
 * Extracts verifiable evidence from an exported SVG file string
 */
export function analyzeExportedSvgFile(svgContent: string, filename = 'export.svg'): FileEvidence {
  const hasArtwork =
    svgContent.includes('id="Folder_Background_Image"') ||
    svgContent.includes('inkscape:label="Background Image"') ||
    svgContent.includes('data-name="Background Image"') ||
    svgContent.includes('id="Layer_Artwork"') ||
    svgContent.includes('id="Layer_1"') ||
    svgContent.includes('inkscape:label="Layer 1"') ||
    svgContent.includes('data-name="Layer 1"');

  const hasCutContour =
    svgContent.includes('id="Folder_Cut_Line"') ||
    svgContent.includes('inkscape:label="Cut Line"') ||
    svgContent.includes('data-name="Cut Line"') ||
    svgContent.includes('id="Layer_Cut_Contour"') ||
    svgContent.includes('id="Layer_2"') ||
    svgContent.includes('inkscape:label="Layer 2"') ||
    svgContent.includes('data-name="Layer 2"');

  const hasPathLine =
    svgContent.includes('id="Layer_Path_Line"') ||
    svgContent.includes('id="PerfCutContour"') ||
    svgContent.includes('inkscape:label="PerfCutContour"');

  const hasRegMarks =
    svgContent.includes('id="Folder_Registration_Marks"') ||
    svgContent.includes('inkscape:label="Registration Marks"') ||
    svgContent.includes('data-name="Registration Marks"') ||
    svgContent.includes('id="Layer_Registration_Marks"') ||
    svgContent.includes('id="reg_1"') ||
    svgContent.includes('id="reg_2"') ||
    svgContent.includes('id="margin"');

  const spotMatch = svgContent.match(/stroke="(#[A-Fa-f0-9]{6})"[^>]*inkscape:label="CutContour"/i) ||
                    svgContent.match(/inkscape:label="CutContour"[^>]*stroke="(#[A-Fa-f0-9]{6})"/i);
  const spotColor = spotMatch ? spotMatch[1] : undefined;

  const widthMatch = svgContent.match(/width="([0-9.]+)mm"/i);
  const heightMatch = svgContent.match(/height="([0-9.]+)mm"/i);

  const viewBoxMm = widthMatch && heightMatch ? {
    width: parseFloat(widthMatch[1]),
    height: parseFloat(heightMatch[1])
  } : undefined;

  return {
    filename,
    hasArtworkLayer: hasArtwork,
    hasCutContourLayer: hasCutContour,
    hasPathLineLayer: hasPathLine,
    hasRegMarksLayer: hasRegMarks,
    cutContourSpotColor: spotColor,
    viewBoxMm,
  };
}

/**
 * Executes an intelligent evidence-first diagnosis of a print-and-cut problem
 */
export async function diagnosePrintCutIssue(
  userQuery: string,
  evidence: WorkspaceEvidence,
  fileEvidence?: FileEvidence
): Promise<DiagnosticResult> {
  const client = getTypeSafeClient();

  // 1. Compile concrete facts from observable evidence
  const artworkVisible = evidence.layers[PRODUCTION_LAYERS.ARTWORK.id]?.visible ?? true;
  const cutContourVisible = evidence.layers[PRODUCTION_LAYERS.CUT_CONTOUR.id]?.visible ?? true;
  const pathLineVisible = evidence.layers[PRODUCTION_LAYERS.PATH_LINE.id]?.visible ?? true;
  const regMarksVisible = evidence.layers[PRODUCTION_LAYERS.REG_MARKS.id]?.visible ?? true;

  const unplacedCount = evidence.layoutResult.unplacedCount;
  const placedCount = evidence.layoutResult.placedCount;
  const totalRequested = evidence.layoutResult.totalRequested;

  const cutOffset = evidence.contourConfig.offsetMm;
  const smoothing = evidence.selectedAsset?.smoothing ?? evidence.contourConfig.smoothing;
  const contourEnabled = evidence.contourConfig.enabled;

  const topMargin = evidence.mediaConfig.marginsMm.top;
  const bottomMargin = evidence.mediaConfig.marginsMm.bottom;
  const pinchMarginSafe = topMargin >= CUTTER_DEFAULTS.MIN_MARGIN_TOP_MM && bottomMargin >= CUTTER_DEFAULTS.MIN_MARGIN_BOTTOM_MM;

  const regMarksEnabled = evidence.registrationConfig.enabled;

  // 2. Formulate TypeSafe System One Classification Question if online
  let classifiedCategory = 'general';
  if (client && userQuery.trim().length > 3) {
    try {
      const resp = await client.systemOne({
        state: {
          userQuery,
          artworkVisible,
          cutContourVisible,
          cutOffsetMm: cutOffset,
          unplacedStickers: unplacedCount,
          pinchMarginsAdequate: pinchMarginSafe,
          fileEvidenceSummary: fileEvidence
            ? `File: ${fileEvidence.filename}, Artwork: ${fileEvidence.hasArtworkLayer}, CutContour: ${fileEvidence.hasCutContourLayer}, Spot: ${fileEvidence.cutContourSpotColor || 'none'}`
            : 'none',
        },
        questions: {
          issueDomain: choice(
            "Classify the specific print-and-cut defect or user concern described.",
            {
              missing_artwork: "Artwork is missing, disappeared, invisible, or not showing in preview/export.",
              cut_into_design: "Cutline is cutting into the printed graphics, flush border peeling, or white gap issue.",
              unplaced_overflow: "Stickers missing from sheet, unplaced count warning, or not all requested copies fit.",
              registration_pinch_conflict: "Optical registration marks clipping, sensor read failure, or pinch roller collision.",
              cutter_snag_tearing: "Plotter blade snagging, tearing corners, jagged cut paths, or unclosed cut loop.",
              hidden_cutcontour: "Cut line missing from RIP software, hairline not appearing, or invisible cutline.",
              general: "General workflow or unknown print-and-cut query."
            }
          ),
        },
      });

      classifiedCategory = resp.answers.issueDomain.choice;
    } catch (err) {
      console.warn('TypeSafe classification fallback to heuristic analysis', err);
    }
  }

  // 3. Heuristic fallback classification if offline or generic query
  const q = userQuery.toLowerCase();
  if (classifiedCategory === 'general') {
    if (q.includes('art') || q.includes('image') || q.includes('disappear') || q.includes('missing') || q.includes('blank')) {
      classifiedCategory = 'missing_artwork';
    } else if (q.includes('cut into') || q.includes('inside') || q.includes('white edge') || q.includes('bleed') || q.includes('offset')) {
      classifiedCategory = 'cut_into_design';
    } else if (q.includes('fit') || q.includes('overflow') || q.includes('missing sticker') || q.includes('quantity') || unplacedCount > 0) {
      classifiedCategory = 'unplaced_overflow';
    } else if (q.includes('mark') || q.includes('optical') || q.includes('sensor') || q.includes('pinch') || q.includes('roller')) {
      classifiedCategory = 'registration_pinch_conflict';
    } else if (q.includes('tear') || q.includes('snag') || q.includes('smooth') || q.includes('sharp')) {
      classifiedCategory = 'cutter_snag_tearing';
    } else if (!cutContourVisible || q.includes('cutline') || q.includes('contour')) {
      classifiedCategory = 'hidden_cutcontour';
    }
  }

  // 4. Construct Evidence-Based Diagnostic Output adhering to the 5 mandatory sections

  // Case A: Missing Artwork / Invisible Artwork
  if (classifiedCategory === 'missing_artwork' || !artworkVisible || (fileEvidence && fileEvidence.hasArtworkLayer === false)) {
    const isHiddenInUI = !artworkVisible;
    const isExcludedFromExport = fileEvidence && fileEvidence.hasArtworkLayer === false;

    return {
      issueCategory: 'Artwork Visibility & Layer Separation',
      confidenceScore: 0.95,
      whatIFound: isHiddenInUI
        ? `In the Production Layers panel, the "Artwork" layer is currently set to HIDDEN (visibility toggle is off). On the canvas, only the vector cutlines and registration marks are being drawn.`
        : isExcludedFromExport
        ? `In the exported file "${fileEvidence?.filename}", the "Layer_Artwork" group is absent. However, vector cut paths and registration marks are present.`
        : `The artwork is loaded in the project (${evidence.totalAssetsCount} asset), but the user reported artwork disappearance. The canvas layer is currently visible.`,
      likelyCause: isHiddenInUI
        ? `The Artwork layer visibility was toggled off in the right inspector, or was unchecked in the export modal.`
        : isExcludedFromExport
        ? `In the Export Production modal, the "Artwork Layer (Full Color CMYK / RGB)" checkbox was disabled during file generation to produce a cut-only vector file.`
        : `StickerCut PRO strictly maintains layer separation between Artwork, CutContour, and Path Lines rather than flattening them into a single image.`,
      howToFixIt: [
        `1. Open the "Production Layers" panel on the right sidebar.`,
        `2. Locate the "Artwork" row (marked with a blue square).`,
        `3. Click the Eye icon on the right side of the row to make the Artwork layer visible.`,
        `4. If exporting: Click "Export Production" in the top header, and verify that "Artwork Layer (Full Color CMYK / RGB)" is checked before clicking Download.`
      ],
      whyThisHappens: `Commercial print-and-cut workflows (such as VersaWorks or Graphtec Cutting Master) intentionally require separate layers for printed graphics vs cutter knife trajectories. StickerCut PRO keeps these as distinct production layers so they can be isolated for RIP processing without flattening.`,
      verification: `You should immediately see the full-color sticker graphics reappear on the canvas. When exported to SVG or PDF, the file will contain both the full-color artwork and the neon magenta #FF007F CutContour.`,
      autoFixAvailable: isHiddenInUI,
      autoFixLabel: 'Make Artwork Layer Visible',
      fixActionKey: 'unhide_artwork',
    };
  }

  // Case B: Cutline Cutting Into Design / Insufficient Bleed Offset
  if (classifiedCategory === 'cut_into_design' || cutOffset <= 0.2) {
    return {
      issueCategory: 'Contour Offset & Bleed Allowance',
      confidenceScore: 0.92,
      whatIFound: `The Vector Cut Contour offset is currently set to ${cutOffset} mm (Flush Cut). The cutline aligns directly with the perimeter edge of the graphic.`,
      likelyCause: `When printing and cutting vinyl on high-speed roll plotters (like the Graphtec FC8600), mechanical micro-shifting of ±0.3 mm to ±0.5 mm naturally occurs during media feed. With an offset of 0 mm or insufficient bleed, this mechanical tolerance causes the knife to clip into printed colors or reveal white vinyl edges.`,
      howToFixIt: [
        `1. In the left sidebar accordion, click on "3. Cut Contour & Smoothing".`,
        `2. Locate the "Cut Offset" slider.`,
        `3. Increase the offset from ${cutOffset} mm to at least 2.0 mm (standard commercial white border).`,
        `4. Alternatively, if creating a full-bleed sticker, increase the Bleed Overlap margin so color extends beyond the cutline.`
      ],
      whyThisHappens: `Plotter knife drag compensation and pinch-roller tracking have slight physical tolerances. Providing an outward cut offset (kiss-cut border) guarantees that cutter tracking tolerances never damage the core sticker graphic.`,
      verification: `The neon pink (#FF007F) cutline on the canvas will visibly expand outward by 2 mm around the design silhouette, creating a protective safe zone around your artwork.`,
      autoFixAvailable: cutOffset < 2.0,
      autoFixLabel: 'Set Safe 2.0mm Cut Offset',
      fixActionKey: 'increase_cut_offset',
    };
  }

  // Case C: Unplaced Stickers / Sheet Overflow
  if (classifiedCategory === 'unplaced_overflow' || unplacedCount > 0) {
    return {
      issueCategory: 'Media Sizing & Nesting Capacity',
      confidenceScore: 0.96,
      whatIFound: `${unplacedCount} of ${totalRequested} requested stickers could not fit on the current sheet substrate (${placedCount} placed, ${unplacedCount} overflow).`,
      likelyCause: `The selected media substrate (${evidence.mediaConfig.widthMm} × ${evidence.mediaConfig.heightMm} mm) minus the pinch roller margins and registration mark buffers does not have sufficient surface area to accommodate all ${totalRequested} copies with the current ${evidence.nestingConfig.spacingMm} mm spacing.`,
      howToFixIt: [
        `1. Click on "4. Media & Dimensions" in the left sidebar accordion.`,
        `2. Select a larger substrate preset, such as "Roll: 59\\" Vinyl (1498.6 mm wide)" or "Sheet: 13\\" × 19\\"".`,
        `3. Or click on "5. Spacing & Auto Nesting" and enable "Allow 90° Smart Rotation" to pack items more tightly.`
      ],
      whyThisHappens: `StickerCut PRO uses true boundary packing that strictly enforces non-overlapping cuts, Graphtec 5mm registration safety margins, and pinch-roller margins. It never places stickers outside the certified printable area.`,
      verification: `The bottom status bar will update to "Placed: ${totalRequested} / ${totalRequested}", the amber overflow warning banner will disappear, and all stickers will be visible on the layout.`,
      autoFixAvailable: true,
      autoFixLabel: 'Switch to 59" Large Format Roll',
      fixActionKey: 'increase_sheet_size',
    };
  }

  // Case D: Registration Mark / Pinch Roller Margin Conflicts
  if (classifiedCategory === 'registration_pinch_conflict' || !pinchMarginSafe || !regMarksEnabled) {
    return {
      issueCategory: 'Optical Mark Kinematics & Pinch Margins',
      confidenceScore: 0.90,
      whatIFound: !regMarksEnabled
        ? `Graphtec FC8600 Optical Registration Marks are currently DISABLED in Section 6.`
        : `Current top margin (${topMargin}mm) or bottom margin (${bottomMargin}mm) is below the Graphtec FC8600 sensor clearance recommendation (≥20mm top / ≥25mm bottom).`,
      likelyCause: `The optical sensor (ARMS) on vinyl cutters requires unimpeded white substrate clearance to scan fiducial marks without the pinch rollers passing over the marks.`,
      howToFixIt: [
        `1. Open "4. Media & Dimensions" in the left sidebar accordion.`,
        `2. Under "Pinch Roller Safe Margins", ensure Top is set to ≥20 mm and Bottom is set to ≥25 mm.`,
        `3. In "6. Registration Marks", ensure the mark toggle is set to ENABLED.`
      ],
      whyThisHappens: `If registration marks sit under a grit roller or pinch roller, the optical sensor cannot detect the contrast transition, resulting in "Mark Scan Error" on the cutter LCD screen.`,
      verification: `The green status badge at the bottom will read "Graphtec FC8600: Safe Margins Verified", and black L-marks will be positioned with a safe 5mm buffer from all cut paths.`,
      autoFixAvailable: true,
      autoFixLabel: 'Apply Graphtec Recommended Margins',
      fixActionKey: 'increase_pinch_margins',
    };
  }

  // Case E: Blade Snagging & Corner Smoothing
  if (classifiedCategory === 'cutter_snag_tearing' || smoothing <= 0.1) {
    return {
      issueCategory: 'Knife Kinematics & Bézier Smoothing',
      confidenceScore: 0.88,
      whatIFound: `Corner Smoothing is currently set to ${Math.round(smoothing * 100)}% (sharp). The cut contour follows angular corners without curvature easing.`,
      likelyCause: `Drag-knife swivel blades require tangent acceleration easing on sharp concave vertices. Sharp 90° or acute turns at high cutting speeds (>30 cm/s) can snag thin adhesive vinyl.`,
      howToFixIt: [
        `1. Open "3. Cut Contour & Smoothing" in the left sidebar.`,
        `2. Increase the "Corner Smoothing" slider to 35% – 50%.`,
        `3. Click "Regenerate Cut Paths".`
      ],
      whyThisHappens: `StickerCut PRO generates parametric Catmull-Rom cubic Bézier splines. Increasing smoothing rounds acute vertices into continuous tangents, allowing the plotter knife to glide smoothly without snagging.`,
      verification: `Sharp corners on the pink cutline will become rounded smooth arcs, ensuring clean kiss-cut release and prolonging blade lifespan.`,
      autoFixAvailable: false,
    };
  }

  // Case F: Hidden Cut Contour
  return {
    issueCategory: 'CutContour Spot Color Layer Inspection',
    confidenceScore: 0.94,
    whatIFound: `The "Cut Contour" layer is currently toggled OFF in the Production Layers panel, or vector contours are disabled.`,
    likelyCause: `The layer visibility was switched off in the layer manager, hiding the #FF007F CutContour spot-color vector from the canvas.`,
    howToFixIt: [
      `1. Open the "Production Layers" panel on the right sidebar.`,
      `2. Find "Cut Contour" (Spot: CutContour with pink indicator).`,
      `3. Click the Eye icon to toggle visibility ON.`,
      `4. In Section 3 ("Cut Contour & Smoothing"), ensure the top badge reads "ENABLED".`
    ],
    whyThisHappens: `RIP software identifies the cutting line through the spot color named "CutContour" with a hairline stroke. If the layer is hidden or disabled, the cutter software will not receive the path.`,
    verification: `A vibrant neon magenta (#FF007F) line will appear around each sticker instance on the canvas and in the exported SVG/PDF.`,
    autoFixAvailable: !cutContourVisible,
    autoFixLabel: 'Make Cut Contour Visible',
    fixActionKey: 'unhide_cut_contour',
  };
}
