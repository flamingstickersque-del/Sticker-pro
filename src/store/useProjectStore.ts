/**
 * ZUSTAND GLOBAL PRODUCTION STORE
 * Sticker Sheet Automation & Print-and-Cut Production Studio
 */

import { create } from 'zustand';
import {
  CANVAS_DEFAULTS,
  CONTOUR_DEFAULTS,
  CUTTER_DEFAULTS,
  CUTTER_PROFILES,
  MEDIA_PRESETS,
  NESTING_DEFAULTS,
  PRODUCTION_LAYERS,
} from '../config/constants';
import { runAutoNesting, calculateAutoFitMediaHeight } from '../services/nestingEngine';
import {
  ArtworkAsset,
  ContourConfig,
  LayoutResult,
  MediaConfig,
  NestingConfig,
  ProductionLayerState,
  RegistrationConfig,
  UnitType,
} from '../types';

interface ProjectState {
  // Project Meta
  projectName: string;
  unit: UnitType;
  isNestingPending: boolean;

  // Assets & Selection
  artworkList: ArtworkAsset[];
  selectedArtworkId: string | null;

  // Configurations
  contourConfig: ContourConfig;
  mediaConfig: MediaConfig;
  nestingConfig: NestingConfig;
  registrationConfig: RegistrationConfig;

  // Computed Placement Layout
  layoutResult: LayoutResult;

  // Production Layers
  layers: Record<string, ProductionLayerState>;

  // Canvas Viewport
  viewport: {
    zoom: number;
    panX: number;
    panY: number;
  };

  // Actions
  setProjectName: (name: string) => void;
  setUnit: (unit: UnitType) => void;
  addArtwork: (asset: ArtworkAsset) => void;
  removeArtwork: (id: string) => void;
  selectArtwork: (id: string | null) => void;
  updateArtwork: (id: string, updates: Partial<ArtworkAsset>) => void;
  duplicateArtwork: (id: string) => void;
  updateContourConfig: (updates: Partial<ContourConfig>) => void;
  updateMediaConfig: (updates: Partial<MediaConfig>) => void;
  updateNestingConfig: (updates: Partial<NestingConfig>) => void;
  updateRegistrationConfig: (updates: Partial<RegistrationConfig>) => void;
  autoFitMediaDimensions: () => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  setViewport: (updates: Partial<{ zoom: number; panX: number; panY: number }>) => void;
  resetViewport: () => void;
  recalculateNesting: () => void;
  loadProject: (projectData: Partial<ProjectState>) => void;
}

// Initial sample sticker artwork for immediate out-of-the-box interactive experience
const SAMPLE_STICKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF007F;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7928CA;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="90" fill="url(#grad1)" />
  <circle cx="100" cy="100" r="75" fill="#18181B" />
  <path d="M100 45 L115 85 L158 88 L125 116 L135 158 L100 133 L65 158 L75 116 L42 88 L85 85 Z" fill="#FBBF24" />
  <text x="100" y="180" font-family="sans-serif" font-weight="bold" font-size="14" fill="#FFFFFF" text-anchor="middle">PRO CUTTER</text>
</svg>`;

const sampleSvgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(SAMPLE_STICKER_SVG)}`;

const initialArtwork: ArtworkAsset = {
  id: 'asset_default_sample',
  filename: 'pro_cutter_badge.svg',
  fileSizeBytes: 2450,
  fileType: 'image/svg+xml',
  dataUrl: sampleSvgDataUrl,
  svgContent: SAMPLE_STICKER_SVG,
  originalWidthPx: 200,
  originalHeightPx: 200,
  aspectRatio: 1.0,
  widthMm: 76.2, // 76.2mm (exact 3.00 inches) total finished sticker size
  heightMm: 76.2,
  sizingMode: 'cut_line_inclusive',
  quantity: 12,
  rotationDeg: 0,
  smoothing: CONTOUR_DEFAULTS.SMOOTHING_FACTOR,
  effectiveDpi: 300,
  perimeterPoints: Array.from({ length: 24 }).map((_, i) => ({
    x: Math.round(0.45 * Math.cos((i * 2 * Math.PI) / 24) * 1000) / 1000,
    y: Math.round(0.45 * Math.sin((i * 2 * Math.PI) / 24) * 1000) / 1000,
  })),
  originalPerimeterPoints: Array.from({ length: 24 }).map((_, i) => ({
    x: Math.round(0.45 * Math.cos((i * 2 * Math.PI) / 24) * 1000) / 1000,
    y: Math.round(0.45 * Math.sin((i * 2 * Math.PI) / 24) * 1000) / 1000,
  })),
  preflightScore: {
    dpiRating: 'good',
    effectiveDpi: 300,
    vectorIntegrity: 'clean',
    bleedSufficiency: 'adequate',
    recommendedContourStyle: 'smoothed_kiss_cut',
    typeSafeNotes: [
      '300+ DPI commercial grade equivalent vector.',
      'TypeSafe validated circular badge perimeter silhouette.',
      'Vector contours closed with zero knife snag anomalies.',
    ],
  },
};

const initialMedia: MediaConfig = {
  type: 'sheet',
  presetId: 'sheet_12x18',
  widthMm: 304.8, // 12" x 18" standard digital press sheet
  heightMm: 457.2,
  orientation: 'portrait',
  autoFitHeight: true, // Auto-adjust media dimensions enabled by default
  marginsMm: {
    top: CUTTER_DEFAULTS.MIN_MARGIN_TOP_MM,
    bottom: CUTTER_DEFAULTS.MIN_MARGIN_BOTTOM_MM,
    left: CUTTER_DEFAULTS.MIN_MARGIN_LEFT_MM,
    right: CUTTER_DEFAULTS.MIN_MARGIN_RIGHT_MM,
  },
};

const initialContour: ContourConfig = {
  enabled: CONTOUR_DEFAULTS.DEFAULT_ENABLED,
  offsetMm: CONTOUR_DEFAULTS.OFFSET_MM,
  smoothing: CONTOUR_DEFAULTS.SMOOTHING_FACTOR,
  cornerStyle: CONTOUR_DEFAULTS.CORNER_STYLE,
  miterLimit: CONTOUR_DEFAULTS.MITER_LIMIT,
};

const initialNesting: NestingConfig = {
  spacingMm: NESTING_DEFAULTS.DEFAULT_SPACING_MM,
  allow90Rotation: NESTING_DEFAULTS.DEFAULT_ALLOW_90_ROTATION,
  algorithm: NESTING_DEFAULTS.DEFAULT_ALGORITHM,
};

const initialRegMarks: RegistrationConfig = {
  enabled: true,
  preset: CUTTER_DEFAULTS.PRESET,
  cutterModel: CUTTER_DEFAULTS.MODEL,
  markType: CUTTER_DEFAULTS.REG_MARK_TYPE,
  markStyle: CUTTER_DEFAULTS.REG_MARK_STYLE,
  markSizeMm: CUTTER_DEFAULTS.MARK_SIZE_MM,
  lineWidthMm: CUTTER_DEFAULTS.MARK_LINE_WIDTH_MM,
  safetyMarginMm: CUTTER_DEFAULTS.REG_MARK_SAFETY_OFFSET_MM,
  includeInExport: true,
  intermediateMarks: true,
  intermediateIntervalMm: 500,
  barcodeEnabled: false,
  barcodeJobId: 'JOB001',
};

function computeEffectiveMedia(
  media: MediaConfig,
  assets: ArtworkAsset[],
  nesting: NestingConfig,
  contour: ContourConfig,
  regMarks: RegistrationConfig
): MediaConfig {
  if (media.autoFitHeight && assets.length > 0) {
    const fittedHeightMm = calculateAutoFitMediaHeight(assets, media, nesting, contour, regMarks);
    return { ...media, heightMm: fittedHeightMm };
  }
  return media;
}

const initialEffectiveMedia = computeEffectiveMedia(
  initialMedia,
  [initialArtwork],
  initialNesting,
  initialContour,
  initialRegMarks
);

const initialLayout = runAutoNesting(
  [initialArtwork],
  initialEffectiveMedia,
  initialNesting,
  initialContour,
  initialRegMarks
);

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: 'Sticker_Sheet_Job_01',
  unit: 'mm',
  isNestingPending: false,

  artworkList: [initialArtwork],
  selectedArtworkId: initialArtwork.id,

  contourConfig: initialContour,
  mediaConfig: initialEffectiveMedia,
  nestingConfig: initialNesting,
  registrationConfig: initialRegMarks,

  layoutResult: initialLayout,

  layers: {
    [PRODUCTION_LAYERS.ARTWORK.id]: { ...PRODUCTION_LAYERS.ARTWORK },
    [PRODUCTION_LAYERS.CUT_CONTOUR.id]: { ...PRODUCTION_LAYERS.CUT_CONTOUR },
    [PRODUCTION_LAYERS.BLEED_OVERLAP.id]: { ...PRODUCTION_LAYERS.BLEED_OVERLAP },
    [PRODUCTION_LAYERS.PATH_LINE.id]: { ...PRODUCTION_LAYERS.PATH_LINE },
    [PRODUCTION_LAYERS.REG_MARKS.id]: { ...PRODUCTION_LAYERS.REG_MARKS },
  },

  viewport: {
    zoom: 1.0,
    panX: 0,
    panY: 0,
  },

  setProjectName: (name) => set({ projectName: name }),

  setUnit: (unit) => set({ unit }),

  addArtwork: (asset) => {
    set((state) => {
      const assetWithSmoothing: ArtworkAsset = {
        ...asset,
        originalPerimeterPoints: asset.originalPerimeterPoints || asset.perimeterPoints,
        smoothing: asset.smoothing !== undefined ? asset.smoothing : state.contourConfig.smoothing,
      };
      const newList = [...state.artworkList, assetWithSmoothing];
      const effMedia = computeEffectiveMedia(
        state.mediaConfig,
        newList,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      const newLayout = runAutoNesting(
        newList,
        effMedia,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      return {
        artworkList: newList,
        selectedArtworkId: asset.id,
        mediaConfig: effMedia,
        layoutResult: newLayout,
      };
    });
  },

  removeArtwork: (id) => {
    set((state) => {
      const newList = state.artworkList.filter((a) => a.id !== id);
      const nextSelected = state.selectedArtworkId === id ? (newList[0]?.id || null) : state.selectedArtworkId;
      const effMedia = computeEffectiveMedia(
        state.mediaConfig,
        newList,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      const newLayout = runAutoNesting(
        newList,
        effMedia,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      return {
        artworkList: newList,
        selectedArtworkId: nextSelected,
        mediaConfig: effMedia,
        layoutResult: newLayout,
      };
    });
  },

  selectArtwork: (id) => set({ selectedArtworkId: id }),

  updateArtwork: (id, updates) => {
    set((state) => {
      const newList = state.artworkList.map((a) => {
        if (a.id !== id) return a;
        const merged: ArtworkAsset = { ...a, ...updates };
        // If dataUrl changed to a transparent PNG or raster image, update fileType and clear stale svgContent
        if (updates.dataUrl && (updates.dataUrl.startsWith('data:image/png') || updates.dataUrl.startsWith('blob:'))) {
          merged.fileType = 'image/png';
          if (!('svgContent' in updates)) {
            merged.svgContent = undefined;
          }
        }
        // Background removal crops the artwork to its silhouette, which changes
        // the aspect ratio. Keep the configured total width and re-derive the
        // height so the artwork is never stretched.
        if (
          updates.aspectRatio &&
          updates.aspectRatio > 0 &&
          updates.widthMm === undefined &&
          updates.heightMm === undefined
        ) {
          merged.heightMm = Math.round((merged.widthMm / updates.aspectRatio) * 10) / 10;
        }
        return merged;
      });
      const effMedia = computeEffectiveMedia(
        state.mediaConfig,
        newList,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      const newLayout = runAutoNesting(
        newList,
        effMedia,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      return {
        artworkList: newList,
        mediaConfig: effMedia,
        layoutResult: newLayout,
      };
    });
  },

  duplicateArtwork: (id) => {
    const asset = get().artworkList.find((a) => a.id === id);
    if (!asset) return;
    const duplicated: ArtworkAsset = {
      ...asset,
      id: `asset_${Date.now()}`,
      filename: `${asset.filename.replace(/\.[^/.]+$/, '')}_copy.png`,
    };
    get().addArtwork(duplicated);
  },

  updateContourConfig: (updates) => {
    set((state) => {
      const newConfig = { ...state.contourConfig, ...updates };
      const effMedia = computeEffectiveMedia(
        state.mediaConfig,
        state.artworkList,
        state.nestingConfig,
        newConfig,
        state.registrationConfig
      );
      const newLayout = runAutoNesting(
        state.artworkList,
        effMedia,
        state.nestingConfig,
        newConfig,
        state.registrationConfig
      );
      return {
        contourConfig: newConfig,
        mediaConfig: effMedia,
        layoutResult: newLayout,
      };
    });
  },

  updateMediaConfig: (updates) => {
    set((state) => {
      const intermediateConfig = { ...state.mediaConfig, ...updates };
      const effMedia = computeEffectiveMedia(
        intermediateConfig,
        state.artworkList,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      const newLayout = runAutoNesting(
        state.artworkList,
        effMedia,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      return {
        mediaConfig: effMedia,
        layoutResult: newLayout,
      };
    });
  },

  updateNestingConfig: (updates) => {
    set((state) => {
      const newConfig = { ...state.nestingConfig, ...updates };
      const effMedia = computeEffectiveMedia(
        state.mediaConfig,
        state.artworkList,
        newConfig,
        state.contourConfig,
        state.registrationConfig
      );
      const newLayout = runAutoNesting(
        state.artworkList,
        effMedia,
        newConfig,
        state.contourConfig,
        state.registrationConfig
      );
      return {
        nestingConfig: newConfig,
        mediaConfig: effMedia,
        layoutResult: newLayout,
      };
    });
  },

  updateRegistrationConfig: (updates) => {
    set((state) => {
      const newConfig = { ...state.registrationConfig, ...updates };
      const effMedia = computeEffectiveMedia(
        state.mediaConfig,
        state.artworkList,
        state.nestingConfig,
        state.contourConfig,
        newConfig
      );
      const newLayout = runAutoNesting(
        state.artworkList,
        effMedia,
        state.nestingConfig,
        state.contourConfig,
        newConfig
      );
      return {
        registrationConfig: newConfig,
        mediaConfig: effMedia,
        layoutResult: newLayout,
      };
    });
  },

  autoFitMediaDimensions: () => {
    set((state) => {
      const fittedHeightMm = calculateAutoFitMediaHeight(
        state.artworkList,
        state.mediaConfig,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      const newMedia: MediaConfig = {
        ...state.mediaConfig,
        heightMm: fittedHeightMm,
        autoFitHeight: true,
      };
      const newLayout = runAutoNesting(
        state.artworkList,
        newMedia,
        state.nestingConfig,
        state.contourConfig,
        state.registrationConfig
      );
      return {
        mediaConfig: newMedia,
        layoutResult: newLayout,
      };
    });
  },

  toggleLayerVisibility: (layerId) => {
    set((state) => {
      const current = state.layers[layerId];
      if (!current) return state;
      return {
        layers: {
          ...state.layers,
          [layerId]: { ...current, visible: !current.visible },
        },
      };
    });
  },

  toggleLayerLock: (layerId) => {
    set((state) => {
      const current = state.layers[layerId];
      if (!current) return state;
      return {
        layers: {
          ...state.layers,
          [layerId]: { ...current, locked: !current.locked },
        },
      };
    });
  },

  setViewport: (updates) => {
    set((state) => ({
      viewport: { ...state.viewport, ...updates },
    }));
  },

  resetViewport: () => {
    set({
      viewport: { zoom: 1.0, panX: 0, panY: 0 },
    });
  },

  recalculateNesting: () => {
    const s = get();
    const effMedia = computeEffectiveMedia(
      s.mediaConfig,
      s.artworkList,
      s.nestingConfig,
      s.contourConfig,
      s.registrationConfig
    );
    const newLayout = runAutoNesting(
      s.artworkList,
      effMedia,
      s.nestingConfig,
      s.contourConfig,
      s.registrationConfig
    );
    set({
      mediaConfig: effMedia,
      layoutResult: newLayout,
    });
  },

  loadProject: (data) => {
    set((state) => {
      const projectName = data.projectName || state.projectName;
      const unit = data.unit || state.unit;
      const artworkList = data.artworkList || state.artworkList;
      const contourConfig = data.contourConfig || state.contourConfig;
      const mediaConfig = data.mediaConfig || state.mediaConfig;
      const nestingConfig = data.nestingConfig || state.nestingConfig;
      const registrationConfig = data.registrationConfig || state.registrationConfig;
      const effMedia = computeEffectiveMedia(
        mediaConfig,
        artworkList,
        nestingConfig,
        contourConfig,
        registrationConfig
      );
      const newLayout = runAutoNesting(
        artworkList,
        effMedia,
        nestingConfig,
        contourConfig,
        registrationConfig
      );
      return {
        projectName,
        unit,
        artworkList,
        contourConfig,
        mediaConfig: effMedia,
        nestingConfig,
        registrationConfig,
        selectedArtworkId: artworkList[0]?.id || null,
        layoutResult: newLayout,
      };
    });
  },
}));
