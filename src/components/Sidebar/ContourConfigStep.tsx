import React, { useState } from 'react';
import { Sliders, Sparkles, RefreshCw, Wand2, Scissors, FileDown, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PHYSICAL_UNITS } from '../../config/constants';
import { BackgroundRemovalModal } from '../Modals/BackgroundRemovalModal';
import { exportProductionSvg, exportProductionPdf, saveFile } from '../../services/exportEngine';
import { ArtworkAsset } from '../../types';

interface ContourPreset {
  id: string;
  name: string;
  offsetMm: number;
  smoothing: number;
  desc: string;
}

const CONTOUR_PRESETS: ContourPreset[] = [
  { id: 'tight', name: 'Tight Die-Cut', offsetMm: 0.0, smoothing: 0.25, desc: '0.0mm exact silhouette hug' },
  { id: 'bleed', name: 'Bleed Cut', offsetMm: 1.5, smoothing: 0.35, desc: '1.5mm bleed cutline' },
  { id: 'kiss_cut', name: 'Kiss-Cut', offsetMm: 2.0, smoothing: 0.45, desc: '2.0mm peel margin' },
  { id: 'pill', name: 'Capsule Badge', offsetMm: 3.5, smoothing: 0.85, desc: '3.5mm rounded pill' },
];

export const ContourConfigStep: React.FC = () => {
  const {
    contourConfig,
    updateContourConfig,
    updateArtwork,
    unit,
    recalculateNesting,
    artworkList,
    selectedArtworkId,
    mediaConfig,
    layoutResult,
    projectName,
  } = useProjectStore();

  const [isBgModalOpen, setIsBgModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const isMm = unit === 'mm';
  const conversion = isMm ? 1 : PHYSICAL_UNITS.MM_TO_INCH;
  const unitLabel = isMm ? 'mm' : 'in';

  const displayOffset = Math.round(contourConfig.offsetMm * conversion * 100) / 100;
  const selectedAsset = artworkList.find((a) => a.id === selectedArtworkId) || artworkList[0];
  const currentSmoothing = selectedAsset?.smoothing !== undefined
    ? selectedAsset.smoothing
    : contourConfig.smoothing;
  const smoothingPercent = Math.round(currentSmoothing * 100);

  const recommendedStyle = selectedAsset?.preflightScore?.recommendedContourStyle;

  // Detect which preset currently matches the active contour configuration
  const currentPresetId = CONTOUR_PRESETS.find(
    (p) => Math.abs(p.offsetMm - contourConfig.offsetMm) <= 0.15
  )?.id || 'custom';

  const handleSelectPreset = (preset: ContourPreset) => {
    updateContourConfig({
      enabled: true,
      offsetMm: preset.offsetMm,
      smoothing: preset.smoothing,
    });
    if (selectedAsset) {
      updateArtwork(selectedAsset.id, { smoothing: preset.smoothing });
    }
  };

  const handleOffsetSlider = (valStr: string) => {
    const val = parseFloat(valStr);
    const newOffsetMm = isMm ? val : val * PHYSICAL_UNITS.INCH_TO_MM;
    updateContourConfig({ offsetMm: newOffsetMm });
  };

  const handleSmoothingSlider = (valStr: string) => {
    const factor = parseFloat(valStr) / 100;
    if (selectedAsset) {
      updateArtwork(selectedAsset.id, { smoothing: factor });
    } else {
      updateContourConfig({ smoothing: factor });
    }
  };

  const handleExportPreset = async (format: 'cm5_svg' | 'prod_pdf') => {
    setIsExporting(format);
    try {
      const assetsMap = artworkList.reduce((acc, a) => {
        acc[a.id] = a;
        return acc;
      }, {} as Record<string, ArtworkAsset>);

      const activePresetName = CONTOUR_PRESETS.find((p) => p.id === currentPresetId)?.name || 'Custom';
      const baseName = `${projectName || 'Sticker_Sheet'}_${activePresetName.replace(/\s+/g, '_')}`;

      if (format === 'cm5_svg') {
        const svgContent = exportProductionSvg({
          format: 'svg',
          filename: `${baseName}_CM5.svg`,
          media: mediaConfig,
          instances: layoutResult.instances,
          regMarks: layoutResult.registrationMarks,
          assets: assetsMap,
          layers: {
            artwork: true,
            cutContour: true,
            pathLine: false,
            regMarks: true,
          },
        });
        await saveFile(svgContent, `${baseName}_CM5.svg`, 'image/svg+xml');
      } else {
        const pdfBlob = await exportProductionPdf({
          format: 'pdf',
          filename: `${baseName}_Production.pdf`,
          media: mediaConfig,
          instances: layoutResult.instances,
          regMarks: layoutResult.registrationMarks,
          assets: assetsMap,
          layers: {
            artwork: true,
            cutContour: true,
            pathLine: false,
            regMarks: true,
          },
        });
        await saveFile(pdfBlob, `${baseName}_Production.pdf`, 'application/pdf');
      }
    } catch (err) {
      console.error('Preset export failed:', err);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Enable Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase' }}>
          Vector Cut Contour
        </label>
        <button
          type="button"
          onClick={() => updateContourConfig({ enabled: !contourConfig.enabled })}
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: contourConfig.enabled ? '#ec4899' : '#27272a',
            color: contourConfig.enabled ? '#FFFFFF' : '#71717a',
            transition: 'all 0.15s ease',
          }}
        >
          {contourConfig.enabled ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>

      {contourConfig.enabled && (
        <>
          {/* Contour Cutline Presets */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Scissors size={12} color="#ec4899" />
                Cutline Contour Presets
              </label>
              {currentPresetId !== 'custom' && (
                <span style={{ fontSize: '10px', color: '#ec4899', fontWeight: 600 }}>
                  Active Preset: {CONTOUR_PRESETS.find((p) => p.id === currentPresetId)?.name}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {CONTOUR_PRESETS.map((preset) => {
                const isActive = currentPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      border: isActive ? '1px solid #ec4899' : '1px solid #27272a',
                      backgroundColor: isActive ? 'rgba(236, 72, 153, 0.15)' : '#18181b',
                      color: isActive ? '#ec4899' : '#d4d4d8',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{preset.name}</span>
                      {isActive && <CheckCircle2 size={12} color="#ec4899" />}
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 400, opacity: 0.75, marginTop: '2px' }}>
                      {preset.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Offset Slider & Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#d4d4d8' }}>Cut Offset:</span>
              <span className="font-mono" style={{ fontSize: '11px', color: '#ec4899', fontWeight: 600 }}>
                {displayOffset} {unitLabel}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={isMm ? 15 : 0.6}
              step={isMm ? 0.2 : 0.01}
              value={displayOffset}
              onChange={(e) => handleOffsetSlider(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#71717a', marginTop: '2px' }}>
              <span>0 (Flush Cut)</span>
              <span>{isMm ? '15 mm' : '0.6 in'} (Wide Border)</span>
            </div>
          </div>

          {/* Smoothing Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#d4d4d8' }}>Corner Smoothing:</span>
              <span className="font-mono" style={{ fontSize: '11px', color: '#ec4899', fontWeight: 600 }}>
                {smoothingPercent}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={smoothingPercent}
              onChange={(e) => handleSmoothingSlider(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#71717a', marginTop: '2px' }}>
              <span>0% (Sharp)</span>
              <span>100% (Capsule/Pill)</span>
            </div>
          </div>

          {/* Tighten Perimeter / Background Removal Helper Card */}
          {selectedAsset && (
            <div style={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '6px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: '#f4f4f5' }}>
                <Scissors size={13} color="#ec4899" />
                <span>Cutline Not Tight Around Perimeter?</span>
              </div>
              <p style={{ fontSize: '10px', color: '#a1a1aa', margin: 0, lineHeight: 1.4 }}>
                If designs have white or opaque backgrounds, remove the background to make the cutline hug tight around the true artwork silhouette.
              </p>
              <button
                type="button"
                onClick={() => setIsBgModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(236, 72, 153, 0.15)',
                  border: '1px solid #ec4899',
                  color: '#ec4899',
                  cursor: 'pointer',
                  marginTop: '2px',
                }}
              >
                <Wand2 size={12} />
                <span>Remove Background & Tighten Perimeter</span>
              </button>
            </div>
          )}

          {/* TypeSafe Recommendation Banner */}
          {recommendedStyle && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              padding: '6px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              color: '#93c5fd',
            }}>
              <Sparkles size={13} color="#3b82f6" style={{ flexShrink: 0 }} />
              <span>
                <strong>TypeSafe Choice:</strong> Recommended style is{' '}
                <em style={{ textDecoration: 'underline' }}>{recommendedStyle.replace(/_/g, ' ')}</em>.
              </span>
            </div>
          )}

          {/* Regenerate Button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={recalculateNesting}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <RefreshCw size={13} />
            <span>Regenerate Cut Paths</span>
          </button>

          {/* Direct Export of Active Preset */}
          <div style={{
            marginTop: '4px',
            paddingTop: '10px',
            borderTop: '1px solid #27272a',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <label style={{ fontSize: '10px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>
              Export Active Preset
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleExportPreset('cm5_svg')}
                disabled={!!isExporting}
                style={{
                  padding: '7px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  color: '#10b981',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
                title="Directly export Cutting Master 5 SVG with 3 top-level layer folders"
              >
                <FileDown size={12} />
                <span>⚡ CM5 (SVG)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportPreset('prod_pdf')}
                disabled={!!isExporting}
                style={{
                  padding: '7px 8px',
                  borderRadius: '5px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  color: '#60a5fa',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
                title="Directly export Production PDF with 3 top-level layer folders"
              >
                <FileDown size={12} />
                <span>📥 PDF</span>
              </button>
            </div>
          </div>
        </>
      )}

      {isBgModalOpen && selectedAsset && (
        <BackgroundRemovalModal
          asset={selectedAsset}
          isOpen={isBgModalOpen}
          onClose={() => setIsBgModalOpen(false)}
          onApply={(updates) => {
            updateArtwork(selectedAsset.id, updates);
            setIsBgModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
