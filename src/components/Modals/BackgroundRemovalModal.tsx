import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Wand2,
  Check,
  RefreshCw,
  Eye,
  Pipette,
  Scissors,
  ShieldCheck,
  FileDown,
  Sparkles,
  Cpu,
  Layers,
  Sliders,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { ArtworkAsset, ContourConfig } from '../../types';
import {
  removeImageBackground,
  BackgroundRemovalResult,
  COMMON_BG_PRESETS,
  samplePixelColorFromImage,
} from '../../services/backgroundRemoval';
import { extractArtworkPerimeter, generateContourSvgPath } from '../../services/contourEngine';
import { exportProductionSvg, exportProductionPdf, saveFile } from '../../services/exportEngine';
import { runAutoNesting } from '../../services/nestingEngine';
import { useProjectStore } from '../../store/useProjectStore';

interface Props {
  asset: ArtworkAsset;
  isOpen: boolean;
  onClose: () => void;
  onApply: (updatedAsset: Partial<ArtworkAsset>) => void;
}

export const BackgroundRemovalModal: React.FC<Props> = ({
  asset,
  isOpen,
  onClose,
  onApply,
}) => {
  const { contourConfig, updateContourConfig } = useProjectStore();

  // Engine selection: AI Neural, Edge-Aware Alpha Matting, Exterior Flood, Chroma Key
  const [engine, setEngine] = useState<
    'ai_neural' | 'edge_aware_matting' | 'exterior_flood' | 'chroma_key'
  >('edge_aware_matting');

  const [tolerance, setTolerance] = useState<number>(32);
  const [feather, setFeather] = useState<number>(1.2);
  const [edgeTightness, setEdgeTightness] = useState<number>(1.0);
  const [selectedPreset, setSelectedPreset] = useState<string>('auto');
  const [customColor, setCustomColor] = useState<{ r: number; g: number; b: number } | null>(null);
  const [isEyedropperActive, setIsEyedropperActive] = useState<boolean>(false);
  const [showCutline, setShowCutline] = useState<boolean>(true);
  const [cutlinePreset, setCutlinePreset] = useState<'tight' | 'flush' | 'kiss_cut' | 'pill'>('tight');
  const [customSmoothing, setCustomSmoothing] = useState<number>(0.35);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [aiProgress, setAiProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [isExportingDirect, setIsExportingDirect] = useState<boolean>(false);
  const [processedResult, setProcessedResult] = useState<BackgroundRemovalResult | null>(null);
  const [previewPerimeter, setPreviewPerimeter] = useState<Array<{ x: number; y: number }>>([]);

  const originalImgRef = useRef<HTMLImageElement>(null);
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const effectiveOffsetMm =
    cutlinePreset === 'flush'
      ? 0.0
      : cutlinePreset === 'tight'
      ? 0.0 // Strictly 0.0mm tight contour hugging artwork
      : cutlinePreset === 'kiss_cut'
      ? 2.0
      : 3.5;

  const effectiveSmoothing =
    cutlinePreset === 'flush'
      ? 0.2
      : cutlinePreset === 'tight'
      ? 0.35
      : cutlinePreset === 'kiss_cut'
      ? 0.55
      : 0.85;

  const runCleanup = async () => {
    if (!asset.dataUrl) return;
    setIsProcessing(true);
    if (engine === 'ai_neural') {
      setAiProgress({ percent: 15, stage: 'Starting AI segmentation...' });
    } else {
      setAiProgress(null);
    }

    try {
      const targetColor = customColor
        ? customColor
        : selectedPreset === 'auto'
        ? 'auto'
        : COMMON_BG_PRESETS.find((p) => p.id === selectedPreset)?.color || 'auto';

      const res = await removeImageBackground({
        imageUrl: asset.dataUrl,
        engine,
        tolerance,
        featherRadius: feather,
        edgeTightnessPx: edgeTightness,
        targetColor,
        deFringe: true,
        onProgress: (pct, stage) => {
          setAiProgress({ percent: pct, stage });
        },
      });

      setProcessedResult(res);
      setAiProgress(null);

      // High-precision perimeter extraction (1024px, alpha >= 16) from the background-removed image
      try {
        const tightPoints = await extractArtworkPerimeter(res.dataUrl, 1024, 16);
        if (tightPoints && tightPoints.length >= 3) {
          setPreviewPerimeter(tightPoints);
        }
      } catch (traceErr) {
        console.warn('Perimeter tracing fallback:', traceErr);
      }
    } catch (err) {
      console.error('Background removal failed:', err);
      setAiProgress(null);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isOpen && asset) {
      if (processTimeoutRef.current) clearTimeout(processTimeoutRef.current);
      // Fast debounced trigger (longer debounce for neural model to avoid spamming inference)
      const delay = engine === 'ai_neural' ? 400 : 100;
      processTimeoutRef.current = setTimeout(() => {
        runCleanup();
      }, delay);
    }
    return () => {
      if (processTimeoutRef.current) clearTimeout(processTimeoutRef.current);
    };
  }, [
    isOpen,
    asset.id,
    engine,
    tolerance,
    feather,
    edgeTightness,
    selectedPreset,
    customColor,
  ]);

  if (!isOpen) return null;

  // Active cutline perimeter: uses tight traced perimeter from cleaned image when available
  const activePerimeter =
    previewPerimeter.length >= 3
      ? previewPerimeter
      : asset.originalPerimeterPoints || asset.perimeterPoints || [];

  const isInclusive = asset.sizingMode !== 'artwork_only';
  const offsetReduction = contourConfig.enabled ? effectiveOffsetMm * 2 : 0;
  const targetW = isInclusive ? Math.max(2, asset.widthMm - offsetReduction) : asset.widthMm;
  const targetH = isInclusive ? Math.max(2, asset.heightMm - offsetReduction) : asset.heightMm;

  const previewCutPath = generateContourSvgPath(
    targetW,
    targetH,
    {
      ...contourConfig,
      enabled: true,
      offsetMm: effectiveOffsetMm,
      smoothing: effectiveSmoothing,
    },
    activePerimeter
  );

  // Count Bézier control segments in path
  const nodeCount = (previewCutPath.match(/[MCLQ]/gi) || []).length;

  const handleApply = async (directExportFormat?: 'cm5_svg' | 'prod_pdf') => {
    if (!processedResult) return;
    const finalPerimeter =
      previewPerimeter.length >= 3
        ? previewPerimeter
        : asset.originalPerimeterPoints || asset.perimeterPoints || [];

    // 1. Update project contour configuration
    updateContourConfig({
      enabled: true,
      offsetMm: effectiveOffsetMm,
      smoothing: effectiveSmoothing,
    });

    // 2. Synchronize to global store via onApply
    // Explicitly set fileType to 'image/png' and svgContent to undefined to ensure
    // the transparent raster PNG reflects immediately on the canvas and in all exports!
    onApply({
      dataUrl: processedResult.dataUrl,
      fileType: 'image/png',
      svgContent: undefined,
      perimeterPoints: finalPerimeter,
      originalPerimeterPoints: finalPerimeter,
      smoothing: effectiveSmoothing,
      contourSvgPath: previewCutPath,
      preflightScore: {
        ...asset.preflightScore!,
        vectorIntegrity: 'clean',
        bleedSufficiency: 'adequate',
        recommendedContourStyle: 'tight_die_cut',
        typeSafeNotes: [
          `Background eliminated via ${
            processedResult.engineUsed === 'ai_neural'
              ? 'U-2-Net AI Neural Segmentation'
              : 'Edge-Aware Prepress Alpha Matting'
          }.`,
          `Commercial Bézier cutline generated (${nodeCount} nodes, ${effectiveOffsetMm}mm offset).`,
          'Main production canvas and RIP cutter layers synchronized.',
          ...(asset.preflightScore?.typeSafeNotes || []),
        ],
      },
    });

    // 3. Direct Preset Export: Instant export if clicked
    if (directExportFormat) {
      setIsExportingDirect(true);
      try {
        const state = useProjectStore.getState();
        const updatedAsset: ArtworkAsset = {
          ...asset,
          dataUrl: processedResult.dataUrl,
          fileType: 'image/png',
          svgContent: undefined,
          perimeterPoints: finalPerimeter,
          originalPerimeterPoints: finalPerimeter,
          smoothing: effectiveSmoothing,
          contourSvgPath: previewCutPath,
        };
        const updatedAssetsList = state.artworkList.map((a) => (a.id === asset.id ? updatedAsset : a));
        const updatedAssetsMap = updatedAssetsList.reduce((acc, a) => {
          acc[a.id] = a;
          return acc;
        }, {} as Record<string, ArtworkAsset>);

        const effContour: ContourConfig = {
          ...state.contourConfig,
          enabled: true,
          offsetMm: effectiveOffsetMm,
          smoothing: effectiveSmoothing,
        };

        const updatedLayout = runAutoNesting(
          updatedAssetsList,
          state.mediaConfig,
          state.nestingConfig,
          effContour,
          state.registrationConfig
        );

        const baseName = `${state.projectName || 'Sticker_Sheet'}_Tight_Cutline`;

        if (directExportFormat === 'cm5_svg') {
          const svgContent = exportProductionSvg({
            format: 'svg',
            filename: `${baseName}_CM5.svg`,
            media: state.mediaConfig,
            instances: updatedLayout.instances,
            regMarks: updatedLayout.registrationMarks,
            assets: updatedAssetsMap,
            layers: {
              artwork: true,
              cutContour: true,
              pathLine: false,
              regMarks: true,
            },
          });
          await saveFile(svgContent, `${baseName}_CM5.svg`, 'image/svg+xml');
        } else if (directExportFormat === 'prod_pdf') {
          const pdfBlob = await exportProductionPdf({
            format: 'pdf',
            filename: `${baseName}_Production.pdf`,
            media: state.mediaConfig,
            instances: updatedLayout.instances,
            regMarks: updatedLayout.registrationMarks,
            assets: updatedAssetsMap,
            layers: {
              artwork: true,
              cutContour: true,
              pathLine: false,
              regMarks: true,
            },
          });
          await saveFile(pdfBlob, `${baseName}_Production.pdf`, 'application/pdf');
        }
      } catch (expErr) {
        console.error('Direct preset export failed:', expErr);
      } finally {
        setIsExportingDirect(false);
      }
    }

    onClose();
  };

  const handleOriginalImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!originalImgRef.current) return;
    const rect = originalImgRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    try {
      const sampled = await samplePixelColorFromImage(asset.dataUrl, clickX, clickY);
      setCustomColor(sampled);
      setSelectedPreset('custom');
      setIsEyedropperActive(false);
    } catch (err) {
      console.error('Error sampling color:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #27272a',
            backgroundColor: '#121215',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(236, 72, 153, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wand2 size={18} color="#ec4899" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#f4f4f5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>Background Removal & Tight Perimeter Tracing</span>
                <span
                  style={{
                    fontSize: '10px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  COMMERCIAL PREPRESS
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>
                {asset.filename} • Edge-aware neural segmentation & smooth Bézier vector cutline generation
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#71717a',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Visual Previews */}
          <div
            style={{
              flex: 1,
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              minWidth: 0,
              overflowY: 'auto',
            }}
          >
            {/* Engine Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                backgroundColor: '#121215',
                padding: '4px',
                borderRadius: '8px',
                border: '1px solid #27272a',
              }}
            >
              <button
                type="button"
                onClick={() => setEngine('ai_neural')}
                style={{
                  padding: '7px 8px',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: engine === 'ai_neural' ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
                  color: engine === 'ai_neural' ? '#f43f5e' : '#a1a1aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Cpu size={12} />
                <span>🤖 AI Neural (U-2-Net)</span>
              </button>

              <button
                type="button"
                onClick={() => setEngine('edge_aware_matting')}
                style={{
                  padding: '7px 8px',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor:
                    engine === 'edge_aware_matting' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  color: engine === 'edge_aware_matting' ? '#10b981' : '#a1a1aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Sparkles size={12} />
                <span>✨ Edge-Aware Matting</span>
              </button>

              <button
                type="button"
                onClick={() => setEngine('exterior_flood')}
                style={{
                  padding: '7px 8px',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor:
                    engine === 'exterior_flood' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  color: engine === 'exterior_flood' ? '#60a5fa' : '#a1a1aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Wand2 size={12} />
                <span>🪄 Magic Wand</span>
              </button>

              <button
                type="button"
                onClick={() => setEngine('chroma_key')}
                style={{
                  padding: '7px 8px',
                  borderRadius: '6px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor:
                    engine === 'chroma_key' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                  color: engine === 'chroma_key' ? '#f59e0b' : '#a1a1aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Layers size={12} />
                <span>🎨 Chroma Key</span>
              </button>
            </div>

            {/* AI Progress Notification */}
            {aiProgress && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(236, 72, 153, 0.1)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '11px',
                  color: '#ec4899',
                }}
              >
                <Loader2 size={14} className="animate-spin" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>{aiProgress.stage}</span>
                    <span>{aiProgress.percent}%</span>
                  </div>
                  <div
                    style={{
                      height: '4px',
                      backgroundColor: '#27272a',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${aiProgress.percent}%`,
                        backgroundColor: '#ec4899',
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Two Side-by-Side Previews */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', minHeight: '300px' }}>
              {/* Original Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa' }}>
                    Original Upload {isEyedropperActive && <span style={{ color: '#ec4899' }}>(Click to sample)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEyedropperActive(!isEyedropperActive)}
                    style={{
                      background: isEyedropperActive ? 'rgba(236, 72, 153, 0.2)' : 'none',
                      border: isEyedropperActive ? '1px solid #ec4899' : 'none',
                      fontSize: '10px',
                      color: isEyedropperActive ? '#ec4899' : '#a1a1aa',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    <Pipette size={12} />
                    <span>Eyedropper</span>
                  </button>
                </div>
                <div
                  style={{
                    flex: 1,
                    minHeight: '270px',
                    backgroundColor: '#09090b',
                    borderRadius: '8px',
                    border: isEyedropperActive ? '1px dashed #ec4899' : '1px solid #27272a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: isEyedropperActive ? 'crosshair' : 'default',
                  }}
                >
                  <img
                    ref={originalImgRef}
                    src={asset.dataUrl}
                    alt="Original"
                    onClick={handleOriginalImageClick}
                    style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain' }}
                  />
                </div>
              </div>

              {/* Cleaned Result Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#10b981' }}>
                    Transparent Graphic + Smooth Cutline {isProcessing && '(Processing...)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCutline(!showCutline)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '10px',
                      color: showCutline ? '#ec4899' : '#71717a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Eye size={12} />
                    <span>{showCutline ? 'Hide Cutline' : 'Show Cutline'}</span>
                  </button>
                </div>
                <div
                  style={{
                    flex: 1,
                    minHeight: '270px',
                    backgroundColor: '#09090b',
                    backgroundImage: `linear-gradient(45deg, #18181b 25%, transparent 25%), 
                                      linear-gradient(-45deg, #18181b 25%, transparent 25%), 
                                      linear-gradient(45deg, transparent 75%, #18181b 75%), 
                                      linear-gradient(-45deg, transparent 75%, #18181b 75%)`,
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {processedResult ? (
                    <div
                      style={{
                        position: 'relative',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={processedResult.dataUrl}
                        alt="Cleaned"
                        style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain' }}
                      />
                      {showCutline && previewCutPath && (
                        <svg
                          viewBox={`-${asset.widthMm / 2} -${asset.heightMm / 2} ${asset.widthMm} ${asset.heightMm}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                          }}
                        >
                          <path
                            d={previewCutPath}
                            fill="none"
                            stroke="#FF007F"
                            strokeWidth="1.25"
                            strokeDasharray="4 2"
                          />
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#71717a', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Processing segmentation & cutline...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status bar */}
            {processedResult && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#121215',
                  border: '1px solid #27272a',
                  fontSize: '11px',
                  color: '#a1a1aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={14} color="#10b981" />
                  <span>
                    Removed Background: <strong style={{ color: '#10b981' }}>{processedResult.removedRatio}% of frame</strong>
                    <span style={{ marginLeft: '8px', color: '#71717a' }}>
                      ({processedResult.engineUsed === 'ai_neural' ? 'U-2-Net Neural Model' : 'CIELAB Guided Matting'})
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Cutline Vector:</span>
                  <strong style={{ color: '#ec4899' }}>
                    ⚡ {nodeCount} Bézier Nodes • {effectiveOffsetMm}mm {cutlinePreset}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Controls Sidebar */}
          <div
            style={{
              width: '320px',
              borderLeft: '1px solid #27272a',
              padding: '18px',
              backgroundColor: '#141417',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              overflowY: 'auto',
            }}
          >
            {/* Background Color Presets (When in non-AI modes) */}
            {engine !== 'ai_neural' && (
              <div>
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#a1a1aa',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Target Background Color
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  {COMMON_BG_PRESETS.map((preset) => {
                    const isActive = selectedPreset === preset.id && !customColor;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPreset(preset.id);
                          setCustomColor(null);
                        }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          border: isActive ? '1px solid #ec4899' : '1px solid #27272a',
                          backgroundColor: isActive ? 'rgba(236, 72, 153, 0.15)' : '#18181b',
                          color: isActive ? '#f43f5e' : '#a1a1aa',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                {customColor && (
                  <div
                    style={{
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '10px',
                      color: '#10b981',
                    }}
                  >
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '3px',
                        backgroundColor: `rgb(${customColor.r}, ${customColor.g}, ${customColor.b})`,
                        border: '1px solid #fff',
                      }}
                    />
                    <span>Custom Sampled: RGB({customColor.r}, {customColor.g}, {customColor.b})</span>
                  </div>
                )}
              </div>
            )}

            {/* Edge Tightness (Perimeter Inset) */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: '#d4d4d8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Scissors size={12} color="#ec4899" />
                  <strong>Tighten Perimeter (Inset):</strong>
                </span>
                <span className="font-mono" style={{ fontSize: '11px', color: '#ec4899', fontWeight: 600 }}>
                  {edgeTightness}px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                step="0.2"
                value={edgeTightness}
                onChange={(e) => setEdgeTightness(Number(e.target.value))}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '9px',
                  color: '#71717a',
                  marginTop: '2px',
                }}
              >
                <span>0px (Raw Border)</span>
                <span>1.0px (Tight Silhouette)</span>
                <span>3px+ (Deep Inset)</span>
              </div>
            </div>

            {/* CIELAB ΔE Color Tolerance (When in color-based modes) */}
            {engine !== 'ai_neural' && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#d4d4d8' }}>CIELAB ΔE Tolerance:</span>
                  <span className="font-mono" style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                    ΔE {tolerance}
                  </span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="75"
                  step="2"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9px',
                    color: '#71717a',
                    marginTop: '2px',
                  }}
                >
                  <span>Strict (12)</span>
                  <span>Balanced (32)</span>
                  <span>Broad (60)</span>
                </div>
              </div>
            )}

            {/* Edge Anti-Alias / Guided Feather */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#d4d4d8' }}>Edge Anti-Alias / Feather:</span>
                <span className="font-mono" style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                  {feather}px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.2"
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
              />
            </div>

            {/* Cutline Contour Presets */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#a1a1aa',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Scissors size={12} color="#ec4899" />
                  Cutline Offset Preset
                </label>
                <span style={{ fontSize: '10px', color: '#ec4899', fontWeight: 600 }}>
                  {effectiveOffsetMm.toFixed(1)} mm
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setCutlinePreset('tight')}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: cutlinePreset === 'tight' ? '1px solid #ec4899' : '1px solid #27272a',
                    backgroundColor: cutlinePreset === 'tight' ? 'rgba(236, 72, 153, 0.15)' : '#18181b',
                    color: cutlinePreset === 'tight' ? '#ec4899' : '#d4d4d8',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={11} color="#ec4899" />
                    <span>Tight Die-Cut</span>
                  </div>
                  <div style={{ fontSize: '9px', fontWeight: 400, opacity: 0.75, marginTop: '2px' }}>
                    0.0mm • Zero-offset hug
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCutlinePreset('flush')}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: cutlinePreset === 'flush' ? '1px solid #ec4899' : '1px solid #27272a',
                    backgroundColor: cutlinePreset === 'flush' ? 'rgba(236, 72, 153, 0.15)' : '#18181b',
                    color: cutlinePreset === 'flush' ? '#ec4899' : '#d4d4d8',
                  }}
                >
                  <div>Flush Edge</div>
                  <div style={{ fontSize: '9px', fontWeight: 400, opacity: 0.75, marginTop: '2px' }}>
                    0.0mm • Exact contour
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCutlinePreset('kiss_cut')}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: cutlinePreset === 'kiss_cut' ? '1px solid #ec4899' : '1px solid #27272a',
                    backgroundColor: cutlinePreset === 'kiss_cut' ? 'rgba(236, 72, 153, 0.15)' : '#18181b',
                    color: cutlinePreset === 'kiss_cut' ? '#ec4899' : '#d4d4d8',
                  }}
                >
                  <div>Kiss-Cut</div>
                  <div style={{ fontSize: '9px', fontWeight: 400, opacity: 0.75, marginTop: '2px' }}>
                    2.0mm • Standard peel
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCutlinePreset('pill')}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: cutlinePreset === 'pill' ? '1px solid #ec4899' : '1px solid #27272a',
                    backgroundColor: cutlinePreset === 'pill' ? 'rgba(236, 72, 153, 0.15)' : '#18181b',
                    color: cutlinePreset === 'pill' ? '#ec4899' : '#d4d4d8',
                  }}
                >
                  <div>Capsule Badge</div>
                  <div style={{ fontSize: '9px', fontWeight: 400, opacity: 0.75, marginTop: '2px' }}>
                    3.5mm • Rounded pill
                  </div>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={runCleanup}
                disabled={isProcessing}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid #3f3f46',
                  backgroundColor: '#27272a',
                  color: '#f4f4f5',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <RefreshCw size={13} className={isProcessing ? 'animate-spin' : ''} />
                <span>Re-Sample & Segment</span>
              </button>

              <button
                type="button"
                onClick={() => handleApply()}
                disabled={!processedResult || isExportingDirect || isProcessing}
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  backgroundColor: '#ec4899',
                  color: '#ffffff',
                  cursor: processedResult && !isExportingDirect ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  opacity: processedResult && !isExportingDirect ? 1 : 0.5,
                }}
              >
                <Check size={14} />
                <span>Apply & Synchronize Cutline</span>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleApply('cm5_svg')}
                  disabled={!processedResult || isExportingDirect}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    cursor: processedResult && !isExportingDirect ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                  title="Applies preset and instantly exports Cutting Master 5 SVG with 3 layer folders"
                >
                  <FileDown size={12} />
                  <span>⚡ Export CM5 (SVG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApply('prod_pdf')}
                  disabled={!processedResult || isExportingDirect}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#60a5fa',
                    cursor: processedResult && !isExportingDirect ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                  title="Applies preset and instantly exports Production PDF with 3 layer folders"
                >
                  <FileDown size={12} />
                  <span>📥 Export PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
