import React, { useRef, useState } from 'react';
import { Upload, Trash2, Copy, Image as ImageIcon, Sparkles, Wand2, Scissors, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { runCompositePreflightAudit } from '../../services/typesafeJudgments';
import {
  extractArtworkPerimeter,
  parseSvgDimensions,
  formatSvgWithExplicitDimensions,
} from '../../services/contourEngine';
import { removeImageBackground } from '../../services/backgroundRemoval';
import { ArtworkAsset } from '../../types';
import { BackgroundRemovalModal } from '../Modals/BackgroundRemovalModal';

export const ArtworkManagerStep: React.FC = () => {
  const {
    artworkList,
    selectedArtworkId,
    selectArtwork,
    addArtwork,
    removeArtwork,
    duplicateArtwork,
    updateArtwork,
    updateContourConfig,
  } = useProjectStore();

  const [editingAsset, setEditingAsset] = useState<ArtworkAsset | null>(null);
  const [autoRemoveBgOnUpload, setAutoRemoveBgOnUpload] = useState<boolean>(false);
  const [isQuickCleaning, setIsQuickCleaning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const isSvg = file.type === 'image/svg+xml' || file.name.endsWith('.svg');
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    if (isSvg) {
      const text = await file.text();
      const dims = parseSvgDimensions(text);
      const formattedSvg = formatSvgWithExplicitDimensions(text);
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(formattedSvg)}`;
      const perimeterPoints = await extractArtworkPerimeter(dataUrl, 1024, 16);

      const targetDim = 76.2; // 3.00 inches standard
      const isWider = dims.aspectRatio >= 1.0;
      const widthMm = isWider ? targetDim : Math.round(targetDim * dims.aspectRatio * 10) / 10;
      const heightMm = isWider ? Math.round((targetDim / dims.aspectRatio) * 10) / 10 : targetDim;
      const effDpi = Math.round(dims.width / (widthMm / 25.4)) || 300;

      const newAsset: ArtworkAsset = {
        id: `asset_${Date.now()}`,
        filename: file.name,
        fileSizeBytes: file.size,
        fileType: 'image/svg+xml',
        dataUrl,
        svgContent: formattedSvg,
        originalWidthPx: Math.round(dims.width),
        originalHeightPx: Math.round(dims.height),
        aspectRatio: dims.aspectRatio,
        widthMm,
        heightMm,
        sizingMode: 'cut_line_inclusive',
        quantity: 12,
        rotationDeg: 0,
        smoothing: useProjectStore.getState().contourConfig.smoothing,
        effectiveDpi: effDpi,
        perimeterPoints: perimeterPoints.length >= 3 ? perimeterPoints : undefined,
        originalPerimeterPoints: perimeterPoints.length >= 3 ? perimeterPoints : undefined,
      };

      const audit = await runCompositePreflightAudit({
        filename: file.name,
        effectiveDpi: effDpi,
        widthMm,
        heightMm,
        isVector: true,
        hasAlpha: true,
        perimeterPointsCount: newAsset.perimeterPoints?.length,
      });
      newAsset.preflightScore = audit;

      addArtwork(newAsset);
    } else {
      // Raster image (PNG / JPG)
      const reader = new FileReader();
      reader.onload = async (e) => {
        let dataUrl = e.target?.result as string;

        // Auto remove background if user enabled option
        if (autoRemoveBgOnUpload) {
          try {
            const bgRes = await removeImageBackground({
              imageUrl: dataUrl,
              engine: 'edge_aware_matting',
              tolerance: 32,
              edgeTightnessPx: 1.0,
            });
            dataUrl = bgRes.dataUrl;
          } catch (err) {
            console.warn('Auto BG removal failed on upload:', err);
          }
        }

        const img = new Image();
        img.onload = async () => {
          const aspect = img.width / (img.height || 1);
          const isWider = aspect >= 1.0;
          const targetDim = 76.2; // 3.00 inches standard
          const defaultW = isWider ? targetDim : Math.round(targetDim * aspect * 10) / 10;
          const defaultH = isWider ? Math.round((targetDim / aspect) * 10) / 10 : targetDim;
          const effDpi = img.width / (defaultW / 25.4);
          const perimeterPoints = await extractArtworkPerimeter(dataUrl, 1024, 16);

          const newAsset: ArtworkAsset = {
            id: `asset_${Date.now()}`,
            filename: file.name,
            fileSizeBytes: file.size,
            fileType: file.type as any,
            dataUrl,
            originalWidthPx: img.width,
            originalHeightPx: img.height,
            aspectRatio: aspect,
            widthMm: defaultW,
            heightMm: defaultH,
            sizingMode: 'cut_line_inclusive',
            quantity: 12,
            rotationDeg: 0,
            smoothing: useProjectStore.getState().contourConfig.smoothing,
            effectiveDpi: Math.round(effDpi),
            perimeterPoints: perimeterPoints.length >= 3 ? perimeterPoints : undefined,
            originalPerimeterPoints: perimeterPoints.length >= 3 ? perimeterPoints : undefined,
          };

          const audit = await runCompositePreflightAudit({
            filename: file.name,
            effectiveDpi: effDpi,
            widthMm: defaultW,
            heightMm: defaultH,
            isVector: false,
            hasAlpha: file.type.includes('png') || autoRemoveBgOnUpload,
            perimeterPointsCount: newAsset.perimeterPoints?.length,
          });
          newAsset.preflightScore = audit;

          addArtwork(newAsset);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickRemoveBg = async (asset: ArtworkAsset) => {
    setIsQuickCleaning(asset.id);
    try {
      const res = await removeImageBackground({
        imageUrl: asset.dataUrl,
        engine: 'edge_aware_matting',
        tolerance: 32,
        edgeTightnessPx: 1.0,
        featherRadius: 1.2,
      });

      // Extract tight perimeter tracing from the cleaned graphic at 1024px resolution
      let finalPerimeter = asset.perimeterPoints;
      try {
        const tightPoints = await extractArtworkPerimeter(res.dataUrl, 1024, 16);
        if (tightPoints && tightPoints.length >= 3) {
          finalPerimeter = tightPoints;
        }
      } catch (traceErr) {
        console.warn('Quick trace perimeter error:', traceErr);
      }

      // Reflect tight die-cut preset (strictly 0.0mm exact boundary hug) in project store
      updateContourConfig({
        enabled: true,
        offsetMm: 0.0,
        smoothing: 0.35,
      });

      updateArtwork(asset.id, {
        dataUrl: res.dataUrl,
        fileType: 'image/png',
        svgContent: undefined,
        perimeterPoints: finalPerimeter,
        originalPerimeterPoints: finalPerimeter,
        smoothing: 0.35,
        preflightScore: {
          ...asset.preflightScore!,
          vectorIntegrity: 'clean',
          bleedSufficiency: 'adequate',
          recommendedContourStyle: 'tight_die_cut',
          typeSafeNotes: [
            'Background cleanly removed via 1-click magic wand.',
            `Tight 0.0mm perimeter silhouette cutline traced (${finalPerimeter?.length || 0} nodes).`,
            'Reflected on cutline presets (0.0mm tight die-cut).',
            ...(asset.preflightScore?.typeSafeNotes || []),
          ],
        },
      });
    } catch (err) {
      console.error('Quick BG removal failed:', err);
    } finally {
      setIsQuickCleaning(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        processFile(e.dataTransfer.files[i]);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        processFile(e.target.files[i]);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '1px dashed #3f3f46',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center',
          backgroundColor: '#18181b',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ec4899')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#3f3f46')}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.svg,.pdf"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <Upload size={22} color="#ec4899" style={{ margin: '0 auto 6px' }} />
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5' }}>
          Drag Artwork Here
        </div>
        <div style={{ fontSize: '10px', color: '#71717a', marginTop: '3px' }}>
          Supports PNG, JPG, SVG, PDF
        </div>
      </div>

      {/* Auto-Remove BG on Upload toggle */}
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        backgroundColor: '#18181b',
        borderRadius: '6px',
        border: '1px solid #27272a',
        fontSize: '11px',
        color: '#d4d4d8',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={autoRemoveBgOnUpload}
          onChange={(e) => setAutoRemoveBgOnUpload(e.target.checked)}
          style={{ accentColor: '#ec4899' }}
        />
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Wand2 size={12} color="#ec4899" />
          <span>Auto-remove background on upload (tight cutline)</span>
        </span>
      </label>

      {/* Asset List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Loaded Artwork ({artworkList.length})
        </div>

        {artworkList.map((asset) => {
          const isSelected = asset.id === selectedArtworkId;
          const isCleaning = isQuickCleaning === asset.id;

          return (
            <div
              key={asset.id}
              onClick={() => selectArtwork(asset.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: isSelected ? '#27272a' : '#18181b',
                border: isSelected ? '1px solid #ec4899' : '1px solid #27272a',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '4px',
                    backgroundColor: '#121215',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}>
                    {asset.dataUrl ? (
                      <img src={asset.dataUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <ImageIcon size={16} color="#71717a" />
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {asset.filename}
                    </div>
                    <div className="font-mono" style={{ fontSize: '10px', color: '#a1a1aa' }}>
                      {asset.widthMm}×{asset.heightMm}mm • {asset.quantity} pcs
                    </div>
                  </div>
                </div>

                {/* Top Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateArtwork(asset.id);
                    }}
                    title="Duplicate Artwork"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeArtwork(asset.id);
                    }}
                    title="Delete Artwork"
                  >
                    <Trash2 size={13} color="#ef4444" />
                  </button>
                </div>
              </div>

              {/* Prominent Background Removal & Tight Perimeter Bar */}
              <div style={{
                display: 'flex',
                gap: '6px',
                paddingTop: '4px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingAsset(asset);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(236, 72, 153, 0.15)',
                    border: '1px solid rgba(236, 72, 153, 0.4)',
                    color: '#ec4899',
                    cursor: 'pointer',
                  }}
                >
                  <Wand2 size={12} />
                  <span>Remove Background</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickRemoveBg(asset);
                  }}
                  disabled={isCleaning}
                  title="1-Click Quick Perimeter Tightening"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '5px 8px',
                    borderRadius: '4px',
                    fontSize: '10.5px',
                    fontWeight: 500,
                    backgroundColor: '#121215',
                    border: '1px solid #3f3f46',
                    color: '#a1a1aa',
                    cursor: isCleaning ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isCleaning ? (
                    <span>Tightening...</span>
                  ) : (
                    <>
                      <Scissors size={11} color="#10b981" />
                      <span>Tighten Cutline</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Background Removal Modal */}
      {editingAsset && (
        <BackgroundRemovalModal
          asset={editingAsset}
          isOpen={!!editingAsset}
          onClose={() => setEditingAsset(null)}
          onApply={(updates) => {
            updateArtwork(editingAsset.id, updates);
            setEditingAsset(null);
          }}
        />
      )}
    </div>
  );
};
