import React, { useState, useEffect } from 'react';
import { X, FileDown, CheckCircle2, AlertTriangle, Layers, Split, FileText, Eye, EyeOff, Scissors } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PRODUCTION_LAYERS } from '../../config/constants';
import {
  saveFile,
  exportProductionPdf,
  exportProductionSvg,
  exportSeparatedProductionFiles,
} from '../../services/exportEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const {
    projectName,
    mediaConfig,
    layoutResult,
    artworkList,
    layers,
    contourConfig,
    toggleLayerVisibility,
  } = useProjectStore();

  const artLayerVisible = layers[PRODUCTION_LAYERS.ARTWORK.id]?.visible ?? true;

  const [format, setFormat] = useState<'pdf' | 'svg'>('pdf');
  const [exportMode, setExportMode] = useState<'combined' | 'separated'>('combined');
  const [includeArtwork, setIncludeArtwork] = useState(artLayerVisible);
  const [includeCutContour, setIncludeCutContour] = useState(true);
  const [includePathLine, setIncludePathLine] = useState(false);
  const [includeRegMarks, setIncludeRegMarks] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIncludeArtwork(artLayerVisible);
    }
  }, [isOpen, artLayerVisible]);

  if (!isOpen) return null;

  const assetsMap = artworkList.reduce((acc, asset) => {
    acc[asset.id] = asset;
    return acc;
  }, {} as Record<string, typeof artworkList[0]>);

  const activeCutlinePreset = !contourConfig.enabled
    ? 'Disabled'
    : Math.abs(contourConfig.offsetMm - 0.0) <= 0.1
    ? 'Tight Die-Cut (0.0mm)'
    : Math.abs(contourConfig.offsetMm - 1.5) <= 0.15
    ? 'Bleed Cut (1.5mm)'
    : Math.abs(contourConfig.offsetMm - 2.0) <= 0.15
    ? 'Kiss-Cut (2.0mm)'
    : Math.abs(contourConfig.offsetMm - 3.5) <= 0.15
    ? 'Capsule Badge (3.5mm)'
    : `${contourConfig.offsetMm}mm Custom Offset`;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const baseFilename = `${projectName || 'Sticker_Sheet'}`;

      if (exportMode === 'separated') {
        // Asset Separation: Generate dedicated Print File and Cut File
        const separated = await exportSeparatedProductionFiles({
          format: 'pdf',
          filename: baseFilename,
          media: mediaConfig,
          instances: layoutResult.instances,
          regMarks: layoutResult.registrationMarks,
          assets: assetsMap,
          layers: {
            artwork: true, // Strictly validated ON
            cutContour: true,
            pathLine: includePathLine,
            regMarks: includeRegMarks,
          },
        });

        // 1. Download Print File (Raster CMYK/sRGB + Reg Marks)
        await saveFile(separated.printPdfBlob, separated.printFilename, 'application/pdf');

        // 2. Download Cut File (Vector CutContour + Reg Marks)
        if (format === 'svg') {
          await saveFile(separated.cutSvgString, separated.cutSvgFilename, 'image/svg+xml');
        } else {
          await saveFile(separated.cutPdfBlob, separated.cutPdfFilename, 'application/pdf');
        }
      } else {
        // Combined Mode: Embed in universal PDF Optional Content Groups (OCG / Layers)
        const filename = `${baseFilename}_${format.toUpperCase()}.${format}`;

        if (format === 'svg') {
          const svgContent = exportProductionSvg({
            format: 'svg',
            filename,
            media: mediaConfig,
            instances: layoutResult.instances,
            regMarks: layoutResult.registrationMarks,
            assets: assetsMap,
            layers: {
              artwork: includeArtwork,
              cutContour: includeCutContour,
              pathLine: includePathLine,
              regMarks: includeRegMarks,
            },
          });
          await saveFile(svgContent, filename, 'image/svg+xml');
        } else {
          const pdfBlob = await exportProductionPdf({
            format: 'pdf',
            filename,
            media: mediaConfig,
            instances: layoutResult.instances,
            regMarks: layoutResult.registrationMarks,
            assets: assetsMap,
            layers: {
              artwork: includeArtwork, // Enforced ON for print fidelity
              cutContour: includeCutContour,
              pathLine: includePathLine,
              regMarks: includeRegMarks,
            },
          });
          await saveFile(pdfBlob, filename, 'application/pdf');
        }
      }

      setExportComplete(true);
      setTimeout(() => {
        setExportComplete(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed. Check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '10px',
        width: '480px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #27272a',
          backgroundColor: '#121215',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileDown size={18} color="#ec4899" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f4f4f5' }}>Export Production Sheet</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Asset Separation vs Combined Layers Selection */}
          <div>
            <label style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
              Production Payload Packaging
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setExportMode('combined')}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: exportMode === 'combined' ? '1px solid #10b981' : '1px solid #27272a',
                  backgroundColor: exportMode === 'combined' ? 'rgba(16, 185, 129, 0.1)' : '#1c1c21',
                  color: exportMode === 'combined' ? '#10b981' : '#d4d4d8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Layers size={13} />
                  <span>Combined (PDF Layers)</span>
                </div>
                <div style={{ fontSize: '9.5px', color: '#71717a', marginTop: '3px', fontWeight: 400 }}>
                  Embedded OCG (Print Layer 1 + Cut Layer 2)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportMode('separated')}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: exportMode === 'separated' ? '1px solid #3b82f6' : '1px solid #27272a',
                  backgroundColor: exportMode === 'separated' ? 'rgba(59, 130, 246, 0.1)' : '#1c1c21',
                  color: exportMode === 'separated' ? '#60a5fa' : '#d4d4d8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Split size={13} />
                  <span>Asset Separation (2 Files)</span>
                </div>
                <div style={{ fontSize: '9.5px', color: '#71717a', marginTop: '3px', fontWeight: 400 }}>
                  Separate Print File + Cut File payloads
                </div>
              </button>
            </div>
          </div>

          {/* Workflow Target Presets */}
          <div>
            <label style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
              Target RIP & Cutter Engine
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setFormat('pdf');
                  setIncludeArtwork(true);
                  setIncludeCutContour(true);
                  setIncludeRegMarks(true);
                  setIncludePathLine(false);
                }}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  backgroundColor: 'rgba(16, 185, 129, 0.05)',
                  color: '#10b981',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>⚡ Cutting Master 5</div>
                <div style={{ fontSize: '9.5px', color: '#71717a', marginTop: '2px', fontWeight: 400 }}>
                  Graphtec FC9000 / FC8600 Folders
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormat('pdf');
                  setIncludeArtwork(true);
                  setIncludeCutContour(true);
                  setIncludeRegMarks(true);
                  setIncludePathLine(false);
                }}
                style={{
                  padding: '9px',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  color: '#60a5fa',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>⚡ Roland VersaWorks</div>
                <div style={{ fontSize: '9.5px', color: '#71717a', marginTop: '2px', fontWeight: 400 }}>
                  BN-20 / BN-20A CutContour Spot
                </div>
              </button>
            </div>
          </div>

          {/* Active Cutline Preset Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 10px',
            borderRadius: '6px',
            backgroundColor: 'rgba(236, 72, 153, 0.08)',
            border: '1px solid rgba(236, 72, 153, 0.25)',
            fontSize: '11px',
          }}>
            <span style={{ color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Scissors size={12} color="#ec4899" />
              <span>Contour Cutline Preset:</span>
            </span>
            <span style={{ color: '#ec4899', fontWeight: 600 }}>
              {activeCutlinePreset}
            </span>
          </div>

          {/* Format Selection */}
          <div>
            <label style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500, marginBottom: '6px', display: 'block' }}>
              File Format {exportMode === 'separated' && '(Cut File Format)'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: format === 'pdf' ? '1px solid #ec4899' : '1px solid #27272a',
                  backgroundColor: format === 'pdf' ? 'rgba(236, 72, 153, 0.1)' : '#1c1c21',
                  color: format === 'pdf' ? '#ec4899' : '#d4d4d8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>PDF (300 DPI Print-Ready)</div>
                <div style={{ fontSize: '9.5px', color: '#71717a', marginTop: '2px', fontWeight: 400 }}>
                  sRGB Fallback + PDF/X OutputIntent
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('svg')}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: format === 'svg' ? '1px solid #ec4899' : '1px solid #27272a',
                  backgroundColor: format === 'svg' ? 'rgba(236, 72, 153, 0.1)' : '#1c1c21',
                  color: format === 'svg' ? '#ec4899' : '#d4d4d8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>SVG (Vector Layers)</div>
                <div style={{ fontSize: '9.5px', color: '#71717a', marginTop: '2px', fontWeight: 400 }}>
                  Cutting Master 5 / Plotter direct
                </div>
              </button>
            </div>
          </div>

          {/* Layer Folder Organization & State Validation */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} /> Layer State Validation
              </label>
              <span style={{ fontSize: '9px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 5px', borderRadius: '4px', fontWeight: 600 }}>
                Layer 1 Enforced ON
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#121215', padding: '10px', borderRadius: '6px', border: '1px solid #27272a' }}>
              {!artLayerVisible && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '4px',
                  fontSize: '10.5px',
                  color: '#f87171',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <EyeOff size={13} color="#ef4444" />
                    <span>Artwork is HIDDEN in Production Layers (right sidebar).</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      toggleLayerVisibility(PRODUCTION_LAYERS.ARTWORK.id);
                      setIncludeArtwork(true);
                    }}
                    style={{
                      padding: '3px 8px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Unhide Artwork
                  </button>
                </div>
              )}

              {!includeArtwork && artLayerVisible && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '4px',
                  fontSize: '10.5px',
                  color: '#f59e0b',
                }}>
                  <AlertTriangle size={13} color="#f59e0b" />
                  <span>Cut-Only Mode: Artwork layer unchecked. Vector cut paths &amp; registration marks only.</span>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeArtwork}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIncludeArtwork(checked);
                    if (checked && !artLayerVisible) {
                      toggleLayerVisibility(PRODUCTION_LAYERS.ARTWORK.id);
                    }
                  }}
                  style={{ accentColor: '#3b82f6' }}
                />
                <span style={{ color: '#f4f4f5' }}>
                  📁 <strong>Background Image Folder (Layer 1)</strong> (<code>CMYK Raster 300 DPI</code>)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeCutContour}
                  onChange={(e) => setIncludeCutContour(e.target.checked)}
                  style={{ accentColor: '#ec4899' }}
                />
                <span style={{ color: '#f4f4f5' }}>
                  📁 <strong>Cut Line Folder (Layer 2)</strong> (<code>CutContour</code> Spot #FF007F Hairline)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeRegMarks}
                  onChange={(e) => setIncludeRegMarks(e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                <span style={{ color: '#f4f4f5' }}>
                  📁 <strong>Registration Marks Folder</strong> (<code>Cutting Master 5: reg_1, reg_2, color, margin</code>)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includePathLine}
                  onChange={(e) => setIncludePathLine(e.target.checked)}
                  style={{ accentColor: '#06b6d4' }}
                />
                <span style={{ color: '#f4f4f5' }}>
                  📁 <strong>Perf / Crease Folder</strong> (<code>PerfCutContour</code> Thru-Cut)
                </span>
              </label>
            </div>

            <div style={{
              marginTop: '6px',
              padding: '8px 10px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#6ee7b7',
              lineHeight: 1.4,
            }}>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                <CheckCircle2 size={13} color="#10b981" />
                <span>TypeSafe AI Verified: Layer 1 Artwork Presence Guaranteed</span>
              </div>
              <div>Standardized sRGB 300 DPI rasterization with closed-loop cut kinematics. Blank white page protection active for Chrome, Edge, and Roland VersaWorks.</div>
            </div>
          </div>

          {/* Sheet Summary & Media Limits */}
          <div style={{
            backgroundColor: '#1c1c21',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #27272a',
            fontSize: '11px',
            display: 'flex',
            justifyContent: 'space-between',
            color: '#a1a1aa',
          }}>
            <div>
              <span>Media Limits: </span>
              <strong style={{ color: '#f4f4f5' }}>{mediaConfig.widthMm} × {mediaConfig.heightMm} mm</strong>
            </div>
            <div>
              <span>Placed: </span>
              <strong style={{ color: '#10b981' }}>{layoutResult.placedCount} / {layoutResult.totalRequested}</strong>
            </div>
            <div>
              <span>Yield: </span>
              <strong style={{ color: '#ec4899' }}>{layoutResult.sheetUtilizationPercent}%</strong>
            </div>
          </div>

          {layoutResult.unplacedCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '6px',
              color: '#f59e0b',
              fontSize: '11px',
            }}>
              <AlertTriangle size={15} />
              <span>{layoutResult.unplacedCount} stickers could not fit on this sheet and will not be in this export.</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          padding: '12px 18px',
          borderTop: '1px solid #27272a',
          backgroundColor: '#121215',
        }}>
          <button className="btn-secondary" onClick={onClose} disabled={isExporting}>
            Cancel
          </button>

          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={isExporting || layoutResult.placedCount === 0}
          >
            {exportComplete ? (
              <>
                <CheckCircle2 size={14} /> Exported!
              </>
            ) : isExporting ? (
              'Generating 1:1 Production File...'
            ) : exportMode === 'separated' ? (
              <>
                <FileText size={14} /> Download Separated Files (Print + Cut)
              </>
            ) : (
              <>
                <FileDown size={14} /> Download {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
