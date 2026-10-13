import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Layers, Folder, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { PRODUCTION_LAYERS, CUTTING_MASTER_5_SPEC } from '../../config/constants';

export const LayerManager: React.FC = () => {
  const {
    layers,
    toggleLayerVisibility,
    toggleLayerLock,
    mediaConfig,
    registrationConfig,
  } = useProjectStore();

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    reg_marks: true,
    cut_line: true,
    artwork: true,
  });

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const regLayer = layers[PRODUCTION_LAYERS.REG_MARKS.id] || PRODUCTION_LAYERS.REG_MARKS;
  const cutLayer = layers[PRODUCTION_LAYERS.CUT_CONTOUR.id] || PRODUCTION_LAYERS.CUT_CONTOUR;
  const artLayer = layers[PRODUCTION_LAYERS.ARTWORK.id] || PRODUCTION_LAYERS.ARTWORK;

  const marginString = CUTTING_MASTER_5_SPEC.getMarginName(mediaConfig.marginsMm);
  const colorString = CUTTING_MASTER_5_SPEC.getColorName();
  const reg2String = CUTTING_MASTER_5_SPEC.getReg2Name(0, 0, mediaConfig.marginsMm.left, mediaConfig.marginsMm.top);
  const reg1String = CUTTING_MASTER_5_SPEC.getReg1Name(2, 3, registrationConfig.markSizeMm || 25, registrationConfig.lineWidthMm || 1.0, 20);

  return (
    <div style={{
      backgroundColor: '#18181b',
      borderRadius: '8px',
      border: '1px solid #27272a',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#141417',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} color="#ec4899" />
          <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Production Layer Folders
          </h3>
        </div>
        <span style={{ fontSize: '9px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 5px', borderRadius: '4px', fontWeight: 600 }}>
          CM5 Spec
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* ========================================================= */}
        {/* 1. REGISTRATION MARKS FOLDER (CUTTING MASTER 5 INTEGRATED) */}
        {/* ========================================================= */}
        <div style={{ borderBottom: '1px solid #222226' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            backgroundColor: '#1a1a1e',
          }}>
            <div
              onClick={() => toggleFolder('reg_marks')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}
            >
              {expandedFolders.reg_marks ? <ChevronDown size={13} color="#a1a1aa" /> : <ChevronRight size={13} color="#71717a" />}
              <Folder size={13} color="#10b981" />
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f4f4f5' }}>
                  Registration Marks Folder
                </div>
                <div style={{ fontSize: '9px', color: '#10b981' }}>
                  Cutting Master 5 Integrated
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="btn-icon"
                onClick={() => toggleLayerVisibility(PRODUCTION_LAYERS.REG_MARKS.id)}
                title={regLayer.visible ? 'Hide Marks' : 'Show Marks'}
              >
                {regLayer.visible ? <Eye size={13} color="#d4d4d8" /> : <EyeOff size={13} color="#71717a" />}
              </button>
              <button
                className="btn-icon"
                onClick={() => toggleLayerLock(PRODUCTION_LAYERS.REG_MARKS.id)}
                title={regLayer.locked ? 'Unlock Marks' : 'Lock Marks'}
              >
                {regLayer.locked ? <Lock size={13} color="#f59e0b" /> : <Unlock size={13} color="#71717a" />}
              </button>
            </div>
          </div>

          {/* Sub-layers matching Illustrator Reference */}
          {expandedFolders.reg_marks && (
            <div style={{ backgroundColor: '#121215', padding: '4px 8px 6px 24px', display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid #222226' }}>
              {/* margin */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#a1a1aa', padding: '2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={10} color="#71717a" />
                  <span className="font-mono">{marginString}</span>
                </div>
                <span style={{ fontSize: '8.5px', color: '#71717a' }}>margin</span>
              </div>

              {/* color */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#a1a1aa', padding: '2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={10} color="#71717a" />
                  <span className="font-mono">{colorString}</span>
                </div>
                <span style={{ fontSize: '8.5px', color: '#71717a' }}>color</span>
              </div>

              {/* reg_2 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#a1a1aa', padding: '2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={10} color="#71717a" />
                  <span className="font-mono">{reg2String}</span>
                </div>
                <span style={{ fontSize: '8.5px', color: '#71717a' }}>reg_2</span>
              </div>

              {/* reg_1 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#10b981', padding: '2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={10} color="#71717a" />
                  <span className="font-mono">{reg1String}</span>
                </div>
                <span style={{ fontSize: '8.5px', color: '#10b981' }}>reg_1</span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. CUT LINE FOLDER (LAYER 2 / CutContour)                  */}
        {/* ========================================================= */}
        <div style={{ borderBottom: '1px solid #222226' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            backgroundColor: '#1a1a1e',
          }}>
            <div
              onClick={() => toggleFolder('cut_line')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}
            >
              {expandedFolders.cut_line ? <ChevronDown size={13} color="#a1a1aa" /> : <ChevronRight size={13} color="#71717a" />}
              <Folder size={13} color="#ec4899" />
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f4f4f5' }}>
                  Cut Line Folder (Layer 2)
                </div>
                <div style={{ fontSize: '9px', color: '#ec4899' }}>
                  Spot Color: CutContour (#FF007F)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="btn-icon"
                onClick={() => toggleLayerVisibility(PRODUCTION_LAYERS.CUT_CONTOUR.id)}
                title={cutLayer.visible ? 'Hide Cut Lines' : 'Show Cut Lines'}
              >
                {cutLayer.visible ? <Eye size={13} color="#d4d4d8" /> : <EyeOff size={13} color="#71717a" />}
              </button>
              <button
                className="btn-icon"
                onClick={() => toggleLayerLock(PRODUCTION_LAYERS.CUT_CONTOUR.id)}
                title={cutLayer.locked ? 'Unlock Cut Lines' : 'Lock Cut Lines'}
              >
                {cutLayer.locked ? <Lock size={13} color="#f59e0b" /> : <Unlock size={13} color="#71717a" />}
              </button>
            </div>
          </div>

          {expandedFolders.cut_line && (
            <div style={{ backgroundColor: '#121215', padding: '4px 8px 6px 24px', display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid #222226' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#f4f4f5', padding: '2px 0' }}>
                <span className="font-mono">Layer 2 &gt; Vector Cut Contours</span>
                <span style={{ fontSize: '9px', color: '#ec4899' }}>0.35pt Hairline</span>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. BACKGROUND IMAGE FOLDER (LAYER 1 / Artwork)            */}
        {/* ========================================================= */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            backgroundColor: '#1a1a1e',
          }}>
            <div
              onClick={() => toggleFolder('artwork')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}
            >
              {expandedFolders.artwork ? <ChevronDown size={13} color="#a1a1aa" /> : <ChevronRight size={13} color="#71717a" />}
              <Folder size={13} color="#3b82f6" />
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#f4f4f5' }}>
                  Background Image Folder (Layer 1)
                </div>
                <div style={{ fontSize: '9px', color: '#60a5fa' }}>
                  Full Color Print Artwork Graphics
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="btn-icon"
                onClick={() => toggleLayerVisibility(PRODUCTION_LAYERS.ARTWORK.id)}
                title={artLayer.visible ? 'Hide Artwork' : 'Show Artwork'}
              >
                {artLayer.visible ? <Eye size={13} color="#d4d4d8" /> : <EyeOff size={13} color="#71717a" />}
              </button>
              <button
                className="btn-icon"
                onClick={() => toggleLayerLock(PRODUCTION_LAYERS.ARTWORK.id)}
                title={artLayer.locked ? 'Unlock Artwork' : 'Lock Artwork'}
              >
                {artLayer.locked ? <Lock size={13} color="#f59e0b" /> : <Unlock size={13} color="#71717a" />}
              </button>
            </div>
          </div>

          {expandedFolders.artwork && (
            <div style={{ backgroundColor: '#121215', padding: '4px 8px 6px 24px', display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid #222226' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#f4f4f5', padding: '2px 0' }}>
                <span className="font-mono">Layer 1 &gt; CMYK Raster Images</span>
                <span style={{ fontSize: '9px', color: '#10b981' }}>300 DPI</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
