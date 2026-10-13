import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Wrench,
  Info,
  ShieldCheck,
  FileSearch,
  ArrowRight,
  Layers,
  Sliders,
  Maximize2
} from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  diagnosePrintCutIssue,
  analyzeExportedSvgFile,
  DiagnosticResult,
  FileEvidence,
} from '../../services/troubleshootingAssistant';
import { CUTTER_DEFAULTS, MEDIA_PRESETS, PRODUCTION_LAYERS } from '../../config/constants';

interface SupportAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportAssistantModal: React.FC<SupportAssistantModalProps> = ({
  isOpen,
  onClose,
}) => {
  const store = useProjectStore();
  const {
    layers,
    layoutResult,
    mediaConfig,
    contourConfig,
    nestingConfig,
    registrationConfig,
    artworkList,
    selectedArtworkId,
    toggleLayerVisibility,
    updateContourConfig,
    updateMediaConfig,
    updateRegistrationConfig,
  } = store;

  const [userQuery, setUserQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [fileEvidence, setFileEvidence] = useState<FileEvidence | undefined>(undefined);
  const [fixApplied, setFixApplied] = useState(false);

  // Selected asset
  const selectedAsset = artworkList.find((a) => a.id === selectedArtworkId) || artworkList[0];

  // Compile evidence object from store
  const getEvidence = () => ({
    layers,
    layoutResult,
    mediaConfig,
    contourConfig,
    nestingConfig,
    registrationConfig,
    selectedAsset,
    totalAssetsCount: artworkList.length,
  });

  // Run initial diagnostic when modal opens
  useEffect(() => {
    if (isOpen) {
      handleDiagnose('');
      setFixApplied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDiagnose = async (queryText = userQuery) => {
    setIsAnalyzing(true);
    setFixApplied(false);
    try {
      const result = await diagnosePrintCutIssue(queryText, getEvidence(), fileEvidence);
      setDiagnosticResult(result);
    } catch (err) {
      console.error('Diagnosis failed', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuickSymptom = (symptomText: string) => {
    setUserQuery(symptomText);
    handleDiagnose(symptomText);
  };

  const handleApplyAutoFix = () => {
    if (!diagnosticResult?.fixActionKey) return;

    switch (diagnosticResult.fixActionKey) {
      case 'unhide_artwork':
        toggleLayerVisibility(PRODUCTION_LAYERS.ARTWORK.id);
        break;
      case 'unhide_cut_contour':
        toggleLayerVisibility(PRODUCTION_LAYERS.CUT_CONTOUR.id);
        break;
      case 'increase_cut_offset':
        updateContourConfig({ offsetMm: 2.0 });
        break;
      case 'increase_sheet_size':
        // Switch to roll_59 preset
        const preset = MEDIA_PRESETS.find((p) => p.id === 'roll_59');
        if (preset) {
          updateMediaConfig({
            presetId: 'roll_59',
            widthMm: preset.widthMm,
            heightMm: preset.heightMm,
          });
        }
        break;
      case 'increase_pinch_margins':
        updateMediaConfig({
          marginsMm: {
            ...mediaConfig.marginsMm,
            top: CUTTER_DEFAULTS.MIN_MARGIN_TOP_MM,
            bottom: CUTTER_DEFAULTS.MIN_MARGIN_BOTTOM_MM,
          },
        });
        break;
      case 'enable_reg_marks':
        updateRegistrationConfig({ enabled: true });
        break;
    }

    setFixApplied(true);
    // Re-run diagnosis after auto fix
    setTimeout(() => {
      handleDiagnose(userQuery);
    }, 300);
  };

  const handleSvgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const parsedEvidence = analyzeExportedSvgFile(text, file.name);
      setFileEvidence(parsedEvidence);
      // Re-run diagnosis with file evidence
      setIsAnalyzing(true);
      diagnosePrintCutIssue(userQuery || 'Inspect uploaded export file layers', getEvidence(), parsedEvidence)
        .then((res) => setDiagnosticResult(res))
        .finally(() => setIsAnalyzing(false));
    };
    reader.readAsText(file);
  };

  // State checks for evidence tags
  const artworkVisible = layers[PRODUCTION_LAYERS.ARTWORK.id]?.visible ?? true;
  const cutContourVisible = layers[PRODUCTION_LAYERS.CUT_CONTOUR.id]?.visible ?? true;
  const pathLineVisible = layers[PRODUCTION_LAYERS.PATH_LINE.id]?.visible ?? true;
  const overflowCount = layoutResult.unplacedCount;
  const pinchSafe = mediaConfig.marginsMm.top >= 20 && mediaConfig.marginsMm.bottom >= 25;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: '#141418',
        border: '1px solid #27272a',
        borderRadius: '12px',
        width: '680px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #27272a',
          backgroundColor: '#101014',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}>
              <Sparkles size={16} color="#3b82f6" />
            </div>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
                TypeSafe Technical Support & Workflow Assistant
              </h3>
              <p style={{ fontSize: '10px', color: '#71717a', margin: '2px 0 0' }}>
                Evidence-First Troubleshooting for Print-and-Cut Production
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close Assistant">
            <X size={16} />
          </button>
        </div>

        {/* Live Evidence Ribbon */}
        <div style={{
          padding: '8px 18px',
          backgroundColor: '#0c0c0f',
          borderBottom: '1px solid #1f1f23',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          fontSize: '10px',
        }}>
          <span style={{ color: '#71717a', fontWeight: 600, textTransform: 'uppercase', fontSize: '9px' }}>
            Live Evidence:
          </span>

          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: artworkVisible ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.15)',
            color: artworkVisible ? '#10b981' : '#ef4444',
            border: `1px solid ${artworkVisible ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.3)'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}>
            {artworkVisible ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
            Artwork: {artworkVisible ? 'Visible' : 'Hidden'}
          </span>

          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: cutContourVisible ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.15)',
            color: cutContourVisible ? '#10b981' : '#ef4444',
            border: `1px solid ${cutContourVisible ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.3)'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}>
            CutContour: {cutContourVisible ? 'Visible' : 'Hidden'}
          </span>

          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: overflowCount === 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.15)',
            color: overflowCount === 0 ? '#10b981' : '#f59e0b',
            border: `1px solid ${overflowCount === 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.3)'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}>
            {overflowCount === 0 ? 'Sheet Yield: 100% Fit' : `${overflowCount} Unplaced Overflow`}
          </span>

          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: pinchSafe ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.15)',
            color: pinchSafe ? '#10b981' : '#f59e0b',
            border: `1px solid ${pinchSafe ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.3)'}`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}>
            Pinch Margins: {pinchSafe ? 'Safe' : 'Tight'}
          </span>

          <span style={{
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: '#1f1f23',
            color: '#a1a1aa',
          }}>
            Offset: {contourConfig.offsetMm}mm
          </span>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '16px 18px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          flex: 1,
        }}>
          {/* Quick Symptoms */}
          <div>
            <label style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Common Print-and-Cut Scenarios:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { label: 'Artwork missing from export or canvas', query: 'My artwork is missing from the exported file' },
                { label: 'Cut line cutting into sticker design', query: 'Cut line is cutting inside the artwork graphic' },
                { label: 'Requested stickers overflow the sheet', query: 'Not all stickers fit on my current sheet size' },
                { label: 'Pinch roller sensor warning', query: 'Registration marks conflict with pinch roller margins' },
                { label: 'Blade snagging or tearing corners', query: 'Cutter blade is tearing corners on non-rectangular cuts' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickSymptom(item.query)}
                  style={{
                    backgroundColor: '#1c1c21',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: '#d4d4d8',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#27272a')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* User Input & Inspect File */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Describe your issue (e.g., 'Artwork invisible on export', 'Stickers overlap')..."
              className="studio-input"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDiagnose()}
              style={{ flex: 1, fontSize: '12px' }}
            />
            <button
              className="btn-primary"
              onClick={() => handleDiagnose()}
              disabled={isAnalyzing}
              style={{ backgroundColor: '#2563eb', padding: '0 12px' }}
            >
              {isAnalyzing ? 'Analyzing...' : 'Diagnose'}
            </button>
          </div>

          {/* Exported SVG File Inspector Dropzone */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            backgroundColor: '#18181d',
            borderRadius: '6px',
            border: '1px dashed #3f3f46',
            fontSize: '11px',
            color: '#a1a1aa',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSearch size={14} color="#3b82f6" />
              <span>Inspect Exported SVG File:</span>
            </div>
            <label style={{
              cursor: 'pointer',
              color: '#60a5fa',
              textDecoration: 'underline',
              fontSize: '11px',
            }}>
              Choose file
              <input
                type="file"
                accept=".svg"
                onChange={handleSvgFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Diagnostic Result - Strict 5-Section Evidence-First Structure */}
          {diagnosticResult && (
            <div style={{
              backgroundColor: '#18181d',
              border: '1px solid #27272a',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}>
              {/* Category & Confidence Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272a', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="#3b82f6" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5' }}>
                    {diagnosticResult.issueCategory}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#60a5fa', fontFamily: 'JetBrains Mono, monospace' }}>
                  Confidence: {Math.round(diagnosticResult.confidenceScore * 100)}%
                </div>
              </div>

              {/* 1. What I Found */}
              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  1. What I Found
                </h4>
                <p style={{ fontSize: '12px', color: '#d4d4d8', margin: 0, lineHeight: 1.5 }}>
                  {diagnosticResult.whatIFound}
                </p>
              </div>

              {/* 2. Likely Cause */}
              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  2. Likely Cause
                </h4>
                <p style={{ fontSize: '12px', color: '#d4d4d8', margin: 0, lineHeight: 1.5 }}>
                  {diagnosticResult.likelyCause}
                </p>
              </div>

              {/* 3. How to Fix It */}
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '6px',
                padding: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    3. How to Fix It
                  </h4>
                  {diagnosticResult.autoFixAvailable && !fixApplied && (
                    <button
                      className="btn-primary"
                      onClick={handleApplyAutoFix}
                      style={{ fontSize: '10px', padding: '3px 8px', height: 'auto', backgroundColor: '#10b981' }}
                    >
                      <Wrench size={11} /> {diagnosticResult.autoFixLabel || 'Apply Fix'}
                    </button>
                  )}
                  {fixApplied && (
                    <span style={{ fontSize: '10px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                      <CheckCircle2 size={12} /> Fix Applied to Workspace
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {diagnosticResult.howToFixIt.map((step, idx) => (
                    <div key={idx} style={{ fontSize: '12px', color: '#f4f4f5', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: '#3b82f6', fontWeight: 700 }}>•</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Why This Happens */}
              <div>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  4. Why This Happens (Print-and-Cut Workflow)
                </h4>
                <p style={{ fontSize: '11px', color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
                  {diagnosticResult.whyThisHappens}
                </p>
              </div>

              {/* 5. Verification */}
              <div style={{
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '6px',
                padding: '10px 12px',
              }}>
                <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>
                  5. Verification
                </h4>
                <p style={{ fontSize: '12px', color: '#d4d4d8', margin: 0, lineHeight: 1.5 }}>
                  {diagnosticResult.verification}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid #27272a',
          backgroundColor: '#101014',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '10px', color: '#71717a' }}>
            Powered by TypeSafe (JEV System One) • Automated Production Diagnostics
          </span>
          <button className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
