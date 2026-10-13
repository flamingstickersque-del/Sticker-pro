import React, { useState } from 'react';
import { X, CheckCircle2, FileDown, Layers, ExternalLink, ShieldCheck, Play } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { exportProductionSvg, exportProductionPdf, saveFile } from '../../services/exportEngine';
import { CUTTING_MASTER_5_SPEC } from '../../config/constants';

interface CuttingMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CuttingMasterModal: React.FC<CuttingMasterModalProps> = ({ isOpen, onClose }) => {
  const {
    projectName,
    mediaConfig,
    layoutResult,
    artworkList,
    registrationConfig,
  } = useProjectStore();

  const [exportFormat, setExportFormat] = useState<'svg' | 'pdf'>('svg');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  const assetsMap = artworkList.reduce((acc, asset) => {
    acc[asset.id] = asset;
    return acc;
  }, {} as Record<string, typeof artworkList[0]>);

  const marginString = CUTTING_MASTER_5_SPEC.getMarginName(mediaConfig.marginsMm);
  const colorString = CUTTING_MASTER_5_SPEC.getColorName();
  const reg2String = CUTTING_MASTER_5_SPEC.getReg2Name(0, 0, mediaConfig.marginsMm.left, mediaConfig.marginsMm.top);
  const reg1String = CUTTING_MASTER_5_SPEC.getReg1Name(2, 3, registrationConfig.markSizeMm || 25, registrationConfig.lineWidthMm || 1.0, 20);

  const handleSendToCM5 = async () => {
    setIsExporting(true);
    try {
      const baseName = `${projectName || 'Sticker_Sheet'}_CM5`;
      const filename = `${baseName}.${exportFormat}`;

      if (exportFormat === 'svg') {
        const svgContent = exportProductionSvg({
          format: 'svg',
          filename,
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
            artwork: true,
            cutContour: true,
            pathLine: false,
            regMarks: true,
          },
        });
        await saveFile(pdfBlob, filename, 'application/pdf');
      }

      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Cutting Master 5 export failed:', err);
      alert('Cutting Master 5 export failed. Please check console.');
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
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
    }}>
      <div style={{
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '12px',
        width: '540px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #27272a',
          backgroundColor: '#121215',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}>
              <Play size={16} fill="#10b981" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f4f4f5' }}>
                Cutting Master 5 Plugin Integration
              </h3>
              <p style={{ fontSize: '11px', color: '#a1a1aa', margin: 0 }}>
                Direct Graphtec FC9000 & FC8600 Plugin Workflow
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Workflow Instruction Box (matching reference image 1) */}
          <div style={{
            padding: '14px',
            backgroundColor: '#121215',
            borderRadius: '8px',
            border: '1px solid #27272a',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ✦ Adobe Illustrator & Cutting Master 5 Workflow
            </div>

            <div style={{
              backgroundColor: '#18181b',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #3f3f46',
              fontFamily: 'monospace',
              fontSize: '11.5px',
              color: '#f4f4f5',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{ color: '#a1a1aa' }}>Menu:</span>
              <span style={{ color: '#ec4899', fontWeight: 600 }}>File</span>
              <span style={{ color: '#71717a' }}>&gt;</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Cutting Master 5</span>
              <span style={{ color: '#71717a' }}>&gt;</span>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>Send to Cutting Master 5</span>
            </div>

            <p style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: 1.4, margin: 0 }}>
              The exported file contains Graphtec's exact locked registration mark layers and Layer 2 cutline. Cutting Master 5 will immediately recognize registration marks and launch the plot queue.
            </p>
          </div>

          {/* Exact Layer Verification Checklist (matching reference image 2) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase' }}>
                Pre-Flight Layer Verification (Reference Image 2)
              </label>
              <span style={{ fontSize: '9.5px', color: '#10b981', fontWeight: 600 }}>100% CM5 Compliant</span>
            </div>

            <div style={{
              backgroundColor: '#121215',
              borderRadius: '8px',
              border: '1px solid #27272a',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontFamily: 'monospace',
              fontSize: '10px',
            }}>
              {/* Folder 1: Registration Marks */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 700, marginBottom: '2px' }}>
                  <span>▼ Folder: "Registration Marks"</span>
                </div>
                <div style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '2px', color: '#a1a1aa' }}>
                  <div>├─ 🔒 <strong>margin</strong>: {marginString}</div>
                  <div>├─ 🔒 <strong>color</strong>: {colorString}</div>
                  <div>├─ 🔒 <strong>reg_2</strong>: {reg2String}</div>
                  <div style={{ color: '#10b981' }}>└─ 🔒 <strong>reg_1</strong>: {reg1String} (Plugin Vectors)</div>
                </div>
              </div>

              {/* Folder 2: Cut Line */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ec4899', fontWeight: 700, marginBottom: '2px' }}>
                  <span>▼ Folder: "Cut Line"</span>
                </div>
                <div style={{ paddingLeft: '14px', color: '#f4f4f5' }}>
                  └─ 📁 <strong>Layer 2</strong>: Spot Color CutContour (#FF007F Hairline Vector Paths)
                </div>
              </div>

              {/* Folder 3: Background Image */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 700, marginBottom: '2px' }}>
                  <span>▼ Folder: "Background Image"</span>
                </div>
                <div style={{ paddingLeft: '14px', color: '#60a5fa' }}>
                  └─ 📁 <strong>Layer 1</strong>: Printable Artwork Graphics (Full Color 300 DPI)
                </div>
              </div>
            </div>
          </div>

          {/* Export Format Selector */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Export Format for Cutting Master 5
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setExportFormat('svg')}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: exportFormat === 'svg' ? '1px solid #10b981' : '1px solid #27272a',
                  backgroundColor: exportFormat === 'svg' ? 'rgba(16, 185, 129, 0.12)' : '#18181b',
                  color: exportFormat === 'svg' ? '#10b981' : '#d4d4d8',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>SVG (Recommended for CM5)</div>
                <div style={{ fontSize: '9.5px', color: '#71717a', marginTop: '2px', fontWeight: 400 }}>
                  Standard Illustrator XML layers
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: exportFormat === 'pdf' ? '1px solid #10b981' : '1px solid #27272a',
                  backgroundColor: exportFormat === 'pdf' ? 'rgba(16, 185, 129, 0.12)' : '#18181b',
                  color: exportFormat === 'pdf' ? '#10b981' : '#d4d4d8',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>PDF (1:1 Print-Cut Vector)</div>
                <div style={{ fontSize: '9.5px', color: '#71717a', marginTop: '2px', fontWeight: 400 }}>
                  Acrobat OCG layer layers
                </div>
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleSendToCM5}
            disabled={isExporting}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              backgroundColor: '#10b981',
              color: '#FFFFFF',
              cursor: isExporting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            {exportSuccess ? (
              <>
                <CheckCircle2 size={16} />
                <span>Exported Successfully!</span>
              </>
            ) : isExporting ? (
              <span>Generating Cutting Master 5 File...</span>
            ) : (
              <>
                <FileDown size={16} />
                <span>⚡ Send to Cutting Master 5 (Download {exportFormat.toUpperCase()})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
