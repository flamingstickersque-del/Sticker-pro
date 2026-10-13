/**
 * DOMAIN DATA MODELS & IPC INTERFACES
 * Sticker Sheet Automation & Print-and-Cut Production Studio
 */

export type UnitType = 'mm' | 'in';

/**
 * Type-Safe Rotation Angle Schema
 * Strictly limited to orthogonal cutter kinematic angles
 */
export type RotationAngle = 0 | 90 | 180 | 270;
export const VALID_ROTATION_ANGLES: readonly RotationAngle[] = [0, 90, 180, 270] as const;

export function isValidRotationAngle(deg: number): deg is RotationAngle {
  return VALID_ROTATION_ANGLES.includes(deg as RotationAngle);
}

export function normalizeRotationAngle(deg: number): RotationAngle {
  const normalized = ((Math.round(deg) % 360) + 360) % 360;
  if (normalized >= 45 && normalized < 135) return 90;
  if (normalized >= 135 && normalized < 225) return 180;
  if (normalized >= 225 && normalized < 315) return 270;
  return 0;
}

export interface Margins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type SizingMode = 'cut_line_inclusive' | 'artwork_only';

export interface ArtworkAsset {
  id: string;
  filename: string;
  fileSizeBytes: number;
  fileType: 'image/png' | 'image/jpeg' | 'image/svg+xml' | 'application/pdf';
  dataUrl: string; // Base64 or object URL for canvas sprite preview
  svgContent?: string; // Raw SVG string if vector
  originalWidthPx: number;
  originalHeightPx: number;
  aspectRatio: number;
  // User configurable sticker physical dimensions
  widthMm: number;
  heightMm: number;
  // Sizing mode: whether specified width/height includes the cutline/bleed or is raw artwork size
  sizingMode?: SizingMode;
  targetTotalWidthMm?: number;
  targetTotalHeightMm?: number;
  quantity: number;
  rotationDeg: RotationAngle; // Strictly typed 0 | 90 | 180 | 270
  smoothing?: number; // Per-artwork Bézier corner smoothing factor (0 to 1)
  // Computed pre-flight metrics
  effectiveDpi: number;
  perimeterPoints?: Array<{ x: number; y: number }>; // Normalized silhouette boundary points [-0.5..0.5, -0.5..0.5]
  originalPerimeterPoints?: Array<{ x: number; y: number }>; // Permanent cut line anchor preserved from initial artwork upload
  contourSvgPath?: string;
  preflightScore?: PreflightAuditResult;
  // Cloudinary storage metadata
  cloudinaryPublicId?: string;
  cloudinaryUrl?: string;
}

export interface ContourConfig {
  enabled: boolean;
  offsetMm: number; // Offset distance outward from silhouette (default 2mm)
  smoothing: number; // 0 to 1 Bézier smoothing factor
  cornerStyle: 'round' | 'miter' | 'bevel';
  miterLimit: number;
}

export interface MediaConfig {
  type: 'sheet' | 'roll';
  presetId?: string;
  widthMm: number;
  heightMm: number;
  orientation: 'portrait' | 'landscape';
  marginsMm: Margins;
  // Automatic roll length/sheet height adjustment to hug nested quantity
  autoFitHeight?: boolean;
}

export interface NestingConfig {
  spacingMm: number; // Gap between cutlines
  allow90Rotation: boolean;
  algorithm: 'grid_pack' | 'true_shape';
}

export type CutterPreset =
  | 'graphtec_fc9000'
  | 'graphtec_fc8600'
  | 'roland_bn20'
  | 'summa_opos'
  | 'mimaki_finecut'
  | 'custom';

export type RegMarkStyle =
  | 'graphtec_type1'
  | 'graphtec_type2'
  | 'roland_quad_crop'
  | 'summa_opos'
  | 'mimaki'
  | 'optical_cross';

export interface RegistrationConfig {
  enabled: boolean;
  preset: CutterPreset;
  cutterModel: string;
  markType: string;
  markStyle: RegMarkStyle;
  markSizeMm: number;
  lineWidthMm: number;
  safetyMarginMm: number;
  includeInExport: boolean;
  // Intermediate / segmented marks for long roll feeds (>500mm / 1000mm)
  intermediateMarks: boolean;
  intermediateIntervalMm: number;
  // Graphtec DataLink Barcode (Code 39) for FC9000 automated scan
  barcodeEnabled: boolean;
  barcodeJobId: string;
}

export interface PlacedStickerInstance {
  instanceId: string;
  artworkId: string;
  index: number;
  xMm: number;
  yMm: number;
  widthMm: number;      // Effective placed bounding box width on sheet (mm)
  heightMm: number;     // Effective placed bounding box height on sheet (mm)
  rawWidthMm: number;   // Unrotated artwork physical width (mm)
  rawHeightMm: number;  // Unrotated artwork physical height (mm)
  rotationDeg: RotationAngle; // Effective rotation angle applied (0 | 90 | 180 | 270)
  contourPath?: string;
}

export interface RegistrationMarkInstance {
  id: string;
  type: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'intermediate-left' | 'intermediate-right' | 'barcode';
  xMm: number;
  yMm: number;
  sizeMm: number;
  lines: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  circles?: Array<{ cx: number; cy: number; r: number; filled?: boolean }>;
  rects?: Array<{ x: number; y: number; w: number; h: number; filled?: boolean }>;
}

export interface LayoutResult {
  placedCount: number;
  totalRequested: number;
  unplacedCount: number;
  sheetUtilizationPercent: number;
  instances: PlacedStickerInstance[];
  registrationMarks: RegistrationMarkInstance[];
  printableAreaMm: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

export interface ProductionLayerState {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  spotColorName?: string;
}

export interface PreflightAuditResult {
  dpiRating: 'good' | 'warning' | 'critical';
  effectiveDpi: number;
  vectorIntegrity: 'clean' | 'has_issues' | 'raster_fallback';
  bleedSufficiency: 'adequate' | 'tight' | 'insufficient';
  rotationValidation?: {
    angle: RotationAngle;
    isOrthogonal: boolean;
  };
  typeSafeNotes?: string[];
  recommendedContourStyle?: 'tight_die_cut' | 'pill_badge' | 'smoothed_kiss_cut';
}

/**
 * IPC Interface Schemas (Connecting UI to Rust/Node native services)
 */
export interface GenerateContourRequest {
  assetId: string;
  imageDataUrl?: string;
  svgPathData?: string;
  offsetMm: number;
  smoothingFactor: number;
  cornerStyle: 'round' | 'miter' | 'bevel';
}

export interface GenerateContourResponse {
  assetId: string;
  outerContourSvgPath: string;
  innerCutPaths: string[];
  bounds: { x: number; y: number; width: number; height: number };
  nodeCount: number;
  isClosedLoop: boolean;
}

export interface RunNestingRequest {
  assets: ArtworkAsset[];
  media: MediaConfig;
  nesting: NestingConfig;
  regMarks: RegistrationConfig;
}

export interface ExportProductionFileRequest {
  format: 'pdf' | 'svg';
  filename: string;
  media: MediaConfig;
  instances: PlacedStickerInstance[];
  regMarks: RegistrationMarkInstance[];
  assets: Record<string, ArtworkAsset>;
  layers: {
    artwork: boolean;
    cutContour: boolean;
    pathLine: boolean;
    regMarks: boolean;
  };
}
