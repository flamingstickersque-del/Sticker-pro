import React from 'react';
import { Target, CheckCircle2, Barcode, Sliders, Layers } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { CUTTER_DEFAULTS, CUTTER_PROFILES, PHYSICAL_UNITS } from '../../config/constants';
import { CutterPreset, RegMarkStyle } from '../../types';

export const RegistrationConfigStep: React.FC = () => {
  const {
    registrationConfig,
    updateRegistrationConfig,
    unit,
  } = useProjectStore();

  const isMm = unit === 'mm';
  const conversion = isMm ? 1 : PHYSICAL_UNITS.MM_TO_INCH;
  const unitLabel = isMm ? 'mm' : 'in';

  const displayMarkSize = Math.round(registrationConfig.markSizeMm * conversion * 10) / 10;
  const displayLineWidth = Math.round(registrationConfig.lineWidthMm * conversion * 100) / 100;

  const handlePresetSelect = (presetKey: string) => {
    if (presetKey === 'custom') {
      updateRegistrationConfig({ preset: 'custom' });
      return;
    }
    const profile = CUTTER_PROFILES[presetKey];
    if (!profile) return;

    updateRegistrationConfig({
      preset: presetKey as CutterPreset,
      cutterModel: profile.name,
      markStyle: profile.defaultMarkStyle as RegMarkStyle,
      markSizeMm: profile.markSizeMm,
      lineWidthMm: profile.lineWidthMm,
      safetyMarginMm: profile.safetyMarginMm,
    });
  };

  const handleMarkSizeChange = (valStr: string) => {
    const val = parseFloat(valStr) || 10;
    const newMm = isMm ? val : val * PHYSICAL_UNITS.INCH_TO_MM;
    updateRegistrationConfig({ markSizeMm: newMm });
  };

  const handleLineWidthChange = (valStr: string) => {
    const val = parseFloat(valStr) || 0.5;
    const newMm = isMm ? val : val * PHYSICAL_UNITS.INCH_TO_MM;
    updateRegistrationConfig({ lineWidthMm: newMm });
  };

  const currentProfile = CUTTER_PROFILES[registrationConfig.preset] || CUTTER_PROFILES.graphtec_fc9000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Enable Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase' }}>
          Optical Registration Marks
        </label>
        <button
          type="button"
          onClick={() => updateRegistrationConfig({ enabled: !registrationConfig.enabled })}
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: registrationConfig.enabled ? '#10b981' : '#27272a',
            color: registrationConfig.enabled ? '#FFFFFF' : '#71717a',
            transition: 'all 0.15s ease',
          }}
        >
          {registrationConfig.enabled ? 'ACTIVE' : 'OFF'}
        </button>
      </div>

      {registrationConfig.enabled && (
        <>
          {/* Cutter & Printer Hardware Preset */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Cutter & Printer Profile
            </label>
            <select
              value={registrationConfig.preset || 'graphtec_fc9000'}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="studio-input"
              style={{ width: '100%', cursor: 'pointer' }}
            >
              {Object.entries(CUTTER_PROFILES).map(([key, prof]) => (
                <option key={key} value={key}>
                  {prof.name}
                </option>
              ))}
              <option value="custom">-- Custom Optical Profile --</option>
            </select>

            {/* Quick 1-Click Hardware Switcher Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
              {[
                { id: 'graphtec_fc9000', label: 'Graphtec FC9000', sub: 'Cutting Master 5' },
                { id: 'graphtec_fc8600', label: 'Graphtec FC8600', sub: 'Type 2 L-Marks' },
                { id: 'roland_bn20', label: 'Roland BN-20 / 20A', sub: 'VersaWorks' },
                { id: 'summa_opos', label: 'Summa OPOS', sub: '3mm Solid Squares' },
              ].map((cutter) => {
                const isActive = registrationConfig.preset === cutter.id;
                return (
                  <button
                    key={cutter.id}
                    type="button"
                    onClick={() => handlePresetSelect(cutter.id)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '5px',
                      border: isActive ? '1px solid #10b981' : '1px solid #27272a',
                      backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : '#18181b',
                      color: isActive ? '#10b981' : '#d4d4d8',
                      cursor: 'pointer',
                      textAlign: 'left',
                      lineHeight: '1.25',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '10.5px', fontWeight: 600 }}>{cutter.label}</div>
                    <div style={{ fontSize: '8.5px', color: isActive ? '#34d399' : '#71717a' }}>{cutter.sub}</div>
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: '10px', color: '#10b981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={11} />
              <span>Target RIP: <strong>{currentProfile?.ripPlugin || 'General Cutter'}</strong> ({registrationConfig.markStyle})</span>
            </div>
          </div>

          {/* Mark Style Selector */}
          <div>
            <label style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>
              Optical Mark Geometry Style
            </label>
            <select
              value={registrationConfig.markStyle || 'graphtec_type1'}
              onChange={(e) => updateRegistrationConfig({ markStyle: e.target.value as RegMarkStyle })}
              className="studio-input"
              style={{ width: '100%', cursor: 'pointer' }}
            >
              <option value="graphtec_type1">Graphtec Type 1 (Cutting Master 5 & FC9000)</option>
              <option value="graphtec_type2">Graphtec Type 2 (FC8600 L-Marks)</option>
              <option value="roland_quad_crop">Roland Quad Crop & Circle (BN-20 / VersaWorks)</option>
              <option value="summa_opos">Summa OPOS (3mm Solid Squares)</option>
              <option value="mimaki">Mimaki FineCut (Corner Crop Brackets)</option>
              <option value="optical_cross">Optical Crosshairs (Generic / Camera)</option>
            </select>
          </div>

          {/* Mark Size Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#d4d4d8' }}>Mark Size / Arm Length:</span>
              <span className="font-mono" style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                {displayMarkSize} {unitLabel}
              </span>
            </div>
            <input
              type="range"
              min={isMm ? 3 : 0.12}
              max={isMm ? 30 : 1.2}
              step={isMm ? 1 : 0.05}
              value={displayMarkSize}
              onChange={(e) => handleMarkSizeChange(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#71717a', marginTop: '2px' }}>
              <span>3 mm (Summa)</span>
              <span>10 mm (Roland)</span>
              <span>15 mm (Graphtec)</span>
              <span>30 mm</span>
            </div>
          </div>

          {/* Stroke Width */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#d4d4d8' }}>Stroke Line Width:</span>
              <span className="font-mono" style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                {displayLineWidth} {unitLabel}
              </span>
            </div>
            <input
              type="range"
              min={isMm ? 0.2 : 0.008}
              max={isMm ? 1.5 : 0.06}
              step={isMm ? 0.05 : 0.002}
              value={displayLineWidth}
              onChange={(e) => handleLineWidthChange(e.target.value)}
            />
          </div>

          {/* Intermediate Segment Marks for Long Rolls */}
          <div style={{
            padding: '8px 10px',
            backgroundColor: '#18181b',
            borderRadius: '6px',
            border: '1px solid #27272a',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#f4f4f5', fontWeight: 500 }}>
                Intermediate Roll Segment Marks
              </span>
              <button
                type="button"
                onClick={() => updateRegistrationConfig({ intermediateMarks: !registrationConfig.intermediateMarks })}
                style={{
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: registrationConfig.intermediateMarks ? '#10b981' : '#27272a',
                  color: registrationConfig.intermediateMarks ? '#FFFFFF' : '#71717a',
                }}
              >
                {registrationConfig.intermediateMarks ? 'ON' : 'OFF'}
              </button>
            </div>
            <div style={{ fontSize: '9.5px', color: '#71717a' }}>
              Prevents long vinyl roll skew by adding intermediate alignment marks every 500mm.
            </div>
          </div>

          {/* Graphtec FC9000 DataLink Barcode */}
          <div style={{
            padding: '8px 10px',
            backgroundColor: '#18181b',
            borderRadius: '6px',
            border: '1px solid #27272a',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Barcode size={13} color="#10b981" />
                <span style={{ fontSize: '11px', color: '#f4f4f5', fontWeight: 500 }}>
                  DataLink Barcode (FC9000)
                </span>
              </div>
              <button
                type="button"
                onClick={() => updateRegistrationConfig({ barcodeEnabled: !registrationConfig.barcodeEnabled })}
                style={{
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: registrationConfig.barcodeEnabled ? '#10b981' : '#27272a',
                  color: registrationConfig.barcodeEnabled ? '#FFFFFF' : '#71717a',
                }}
              >
                {registrationConfig.barcodeEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {registrationConfig.barcodeEnabled && (
              <div style={{ marginTop: '4px' }}>
                <div style={{ fontSize: '10px', color: '#71717a', marginBottom: '2px' }}>Barcode Job ID:</div>
                <input
                  type="text"
                  className="studio-input"
                  value={registrationConfig.barcodeJobId || 'JOB001'}
                  onChange={(e) => updateRegistrationConfig({ barcodeJobId: e.target.value.toUpperCase() })}
                  maxLength={12}
                  style={{ width: '100%', textTransform: 'uppercase', fontFamily: 'monospace' }}
                />
              </div>
            )}
            <div style={{ fontSize: '9.5px', color: '#71717a' }}>
              Automatic job barcode scanned by FC9000 optical eye for hands-free cutting.
            </div>
          </div>
        </>
      )}
    </div>
  );
};
