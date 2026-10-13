/**
 * CENTRALIZED CONSTANTS & CONFIGURATION
 * Sticker Sheet Automation & Print-and-Cut Production Application
 * 
 * All units, cutter specs (Graphtec FC8600), nesting defaults,
 * cutline parameters, and validation thresholds are defined here.
 */

export const PHYSICAL_UNITS = {
  INCH_TO_MM: 25.4,
  MM_TO_INCH: 1 / 25.4,
  PT_TO_INCH: 1 / 72,
  INCH_TO_PT: 72,
  MM_TO_PT: 72 / 25.4,
  PT_TO_MM: 25.4 / 72,
  SCREEN_DPI: 96,
  PRINT_TARGET_DPI: 300,
  MINIMUM_ACCEPTABLE_DPI: 150,
  DEFAULT_UNIT: 'mm' as 'mm' | 'in',
} as const;

export interface MediaPreset {
  id: string;
  name: string;
  type: 'sheet' | 'roll';
  widthMm: number;
  heightMm: number;
}

export const MEDIA_PRESETS: MediaPreset[] = [
  { id: 'sheet_a4', name: 'Sheet: A4 (210 × 297 mm)', type: 'sheet', widthMm: 210, heightMm: 297 },
  { id: 'sheet_a3', name: 'Sheet: A3 (297 × 420 mm)', type: 'sheet', widthMm: 297, heightMm: 420 },
  { id: 'sheet_a3_plus', name: 'Sheet: A3+ Super B (329 × 483 mm)', type: 'sheet', widthMm: 329, heightMm: 483 },
  { id: 'sheet_12x18', name: 'Sheet: 12" × 18" (305 × 457 mm)', type: 'sheet', widthMm: 304.8, heightMm: 457.2 },
  { id: 'sheet_13x19', name: 'Sheet: 13" × 19" (330 × 483 mm)', type: 'sheet', widthMm: 330.2, heightMm: 482.6 },
  { id: 'roll_24', name: 'Roll: 24" Vinyl (610 mm wide)', type: 'roll', widthMm: 609.6, heightMm: 1000 },
  { id: 'roll_30', name: 'Roll: 30" Vinyl (762 mm wide)', type: 'roll', widthMm: 762.0, heightMm: 1000 },
  { id: 'roll_54', name: 'Roll: 54" Vinyl (1372 mm wide)', type: 'roll', widthMm: 1371.6, heightMm: 1500 },
  { id: 'roll_59', name: 'Roll: 59" Vinyl (1498.6 mm wide)', type: 'roll', widthMm: 1498.6, heightMm: 1500 },
];

export interface CutterHardwareProfile {
  id: string;
  name: string;
  manufacturer: 'Graphtec' | 'Roland' | 'Summa' | 'Mimaki' | 'Generic';
  defaultMarkStyle: 'graphtec_type1' | 'graphtec_type2' | 'roland_quad_crop' | 'summa_opos' | 'mimaki' | 'optical_cross';
  markSizeMm: number;
  lineWidthMm: number;
  marginsMm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  safetyMarginMm: number;
  supportBarcode: boolean;
  ripPlugin: string;
}

export const CUTTER_PROFILES: Record<string, CutterHardwareProfile> = {
  graphtec_fc9000: {
    id: 'graphtec_fc9000',
    name: 'Graphtec FC9000 (Cutting Master 5)',
    manufacturer: 'Graphtec',
    defaultMarkStyle: 'graphtec_type1',
    markSizeMm: 15.0,
    lineWidthMm: 0.5,
    marginsMm: { top: 20.0, bottom: 25.0, left: 15.0, right: 15.0 },
    safetyMarginMm: 5.0,
    supportBarcode: true,
    ripPlugin: 'Cutting Master 5',
  },
  graphtec_fc8600: {
    id: 'graphtec_fc8600',
    name: 'Graphtec FC8600 (Type 2 L-Marks)',
    manufacturer: 'Graphtec',
    defaultMarkStyle: 'graphtec_type2',
    markSizeMm: 15.0,
    lineWidthMm: 0.5,
    marginsMm: { top: 20.0, bottom: 25.0, left: 15.0, right: 15.0 },
    safetyMarginMm: 5.0,
    supportBarcode: false,
    ripPlugin: 'Cutting Master 4/5',
  },
  roland_bn20: {
    id: 'roland_bn20',
    name: 'Roland VersaSTUDIO BN-20 / BN-20A (VersaWorks)',
    manufacturer: 'Roland',
    defaultMarkStyle: 'roland_quad_crop',
    markSizeMm: 10.0,
    lineWidthMm: 0.5,
    marginsMm: { top: 15.0, bottom: 20.0, left: 10.0, right: 10.0 },
    safetyMarginMm: 6.0,
    supportBarcode: false,
    ripPlugin: 'Roland VersaWorks',
  },
  summa_opos: {
    id: 'summa_opos',
    name: 'SummaCut / S-Class (OPOS Alignment)',
    manufacturer: 'Summa',
    defaultMarkStyle: 'summa_opos',
    markSizeMm: 3.0,
    lineWidthMm: 0.5,
    marginsMm: { top: 20.0, bottom: 25.0, left: 15.0, right: 15.0 },
    safetyMarginMm: 5.0,
    supportBarcode: false,
    ripPlugin: 'GoProduce / WinPlot',
  },
  mimaki_finecut: {
    id: 'mimaki_finecut',
    name: 'Mimaki CG-FX / CG-SRIII (FineCut)',
    manufacturer: 'Mimaki',
    defaultMarkStyle: 'mimaki',
    markSizeMm: 10.0,
    lineWidthMm: 0.5,
    marginsMm: { top: 20.0, bottom: 25.0, left: 15.0, right: 15.0 },
    safetyMarginMm: 5.0,
    supportBarcode: false,
    ripPlugin: 'RasterLink / FineCut',
  },
};

export const CUTTER_DEFAULTS = {
  MODEL: 'Graphtec FC9000 (Cutting Master 5)',
  PRESET: 'graphtec_fc9000' as const,
  REG_MARK_TYPE: 'Type 1 (4-Point & Intermediate Segment Marks)',
  REG_MARK_STYLE: 'graphtec_type1' as const,
  // Graphtec standard registration mark length: 15.0mm (0.6 in)
  MARK_SIZE_MM: 15.0,
  // 0.5mm stroke for optical sensor reading accuracy
  MARK_LINE_WIDTH_MM: 0.5,
  // Minimum clearance for front/rear pinch rollers and optical sensor scan path
  MIN_MARGIN_TOP_MM: 20.0,
  MIN_MARGIN_BOTTOM_MM: 25.0,
  MIN_MARGIN_LEFT_MM: 15.0,
  MIN_MARGIN_RIGHT_MM: 15.0,
  // Buffer between registration mark bounding box and artwork cuts
  REG_MARK_SAFETY_OFFSET_MM: 5.0,
} as const;

export const CONTOUR_DEFAULTS = {
  DEFAULT_ENABLED: true,
  OFFSET_MM: 2.0, // 2mm (~0.08") default white border / bleed cutline
  SMOOTHING_FACTOR: 0.45, // 45% Bézier curve smoothing
  MIN_OFFSET_MM: 0.0,
  MAX_OFFSET_MM: 25.4, // Max 1 inch
  MIN_SMOOTHING: 0.0,
  MAX_SMOOTHING: 1.0,
  CORNER_STYLE: 'round' as 'round' | 'miter' | 'bevel',
  MITER_LIMIT: 2.0,
  CUT_CONTOUR_SPOT_COLOR: 'CutContour',
  CUT_CONTOUR_HEX: '#FF007F', // Standard neon magenta spot color representation
  CUT_CONTOUR_STROKE_WIDTH_PT: 0.5, // 0.5pt hairline in RIP software
} as const;

export const NESTING_DEFAULTS = {
  DEFAULT_SPACING_MM: 3.5, // 3.5mm safe space between cut paths
  MIN_SPACING_MM: 1.0,
  MAX_SPACING_MM: 50.0,
  DEFAULT_ALLOW_90_ROTATION: true,
  DEFAULT_ALGORITHM: 'grid_pack' as 'grid_pack' | 'true_shape',
} as const;

export const CUTTING_MASTER_5_SPEC = {
  getMarginName: (margins?: { top: number; bottom: number; left: number; right: number }) => {
    const t = (margins?.top || 0).toFixed(6);
    const b = (margins?.bottom || 0).toFixed(6);
    const l = (margins?.left || 0).toFixed(6);
    const r = (margins?.right || 0).toFixed(6);
    return `margin ${l} ${b} ${r} ${t}`;
  },
  getColorName: () => 'color 0 0 0 255 0 0 0 255',
  getReg2Name: (offset1 = 0, offset2 = 0, markDistX = 20, markDistY = 20) =>
    `reg_2 ${offset1.toFixed(2)} ${offset2.toFixed(2)} 0.00 0.00 ${markDistX.toFixed(2)} ${markDistY.toFixed(2)}`,
  getReg1Name: (markType: number = 2, pointCount: number = 3, markSizeMm: number = 25.0, lineWidthMm: number = 1.0, marginMm: number = 20.0) =>
    `reg_1 ${markType} ${pointCount} ${markSizeMm.toFixed(2)} ${lineWidthMm.toFixed(2)} ${marginMm.toFixed(2)}`,
};

export const PRODUCTION_LAYERS = {
  ARTWORK: {
    id: 'layer_artwork',
    name: 'Background Image (Layer 1)',
    shortName: 'Layer 1',
    folderName: 'Background Image Folder',
    aiLayerName: 'Layer 1',
    visible: true,
    locked: false,
    exportable: true,
    color: '#3B82F6',
    description: 'High-resolution full color print graphics',
  },
  CUT_CONTOUR: {
    id: 'layer_cut_contour',
    name: 'Cut Line (Layer 2)',
    shortName: 'Layer 2',
    folderName: 'Cut Line Folder',
    aiLayerName: 'Layer 2',
    visible: true,
    locked: false,
    exportable: true,
    color: '#EC4899',
    spotColorName: 'CutContour',
    description: 'Vector cut contour paths for plotter knife',
  },
  BLEED_OVERLAP: {
    id: 'layer_bleed_overlap',
    name: 'Bleed Overlap',
    shortName: 'Bleed',
    folderName: 'Bleed Overlap Folder',
    visible: false,
    locked: false,
    exportable: false,
    color: '#F59E0B',
    description: 'Artwork bleed boundary',
  },
  PATH_LINE: {
    id: 'layer_path_line',
    name: 'Path Line (Crease/Perf)',
    shortName: 'Perf Line',
    folderName: 'Perf Cut Folder',
    visible: false,
    locked: false,
    exportable: true,
    color: '#06B6D4',
    description: 'Perforation / thru-cut crease lines',
  },
  REG_MARKS: {
    id: 'layer_reg_marks',
    name: 'Registration Marks (Cutting Master 5)',
    shortName: 'Cutting Master 5',
    folderName: 'Registration Marks Folder',
    aiLayerName: 'reg_1 / reg_2 / color / margin',
    visible: true,
    locked: true,
    exportable: true,
    color: '#10B981',
    description: 'Graphtec FC8600 / FC9000 optical sensor alignment marks',
  },
} as const;

export const CANVAS_DEFAULTS = {
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5.0,
  ZOOM_STEP: 1.15,
  BG_COLOR: '#18181B', // Dark workspace gray
  SHEET_BG_COLOR: '#FFFFFF', // Bright white production substrate
  GRID_SIZE_MM: 10,
  GRID_MAJOR_MM: 50,
} as const;

export const VALIDATION_LIMITS = {
  MIN_STICKER_DIM_MM: 5.0,
  MAX_STICKER_DIM_MM: 1000.0,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 5000,
  MIN_SHEET_DIM_MM: 50.0,
  MAX_SHEET_DIM_MM: 50000.0, // Long roll feed support up to 50 meters
  MAX_CUSTOM_SHEET_WIDTH_IN: 59.0, // Centralized 59" limit requested by client (Graphtec FC9000-140/160)
  MAX_CUSTOM_SHEET_WIDTH_MM: 1498.6, // 59" in mm
  MAX_CUSTOM_SHEET_LENGTH_IN: 1968.5, // Up to 50 meters (1968.5 in)
  MAX_CUSTOM_SHEET_LENGTH_MM: 50000.0,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  SUPPORTED_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.svg', '.pdf'],
  SUPPORTED_MIME_TYPES: [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'application/pdf',
  ],
} as const;
