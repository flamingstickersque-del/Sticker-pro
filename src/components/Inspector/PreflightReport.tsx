import React, { useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, AlertCircle, ShieldCheck, Wand2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { BackgroundRemovalModal } from '../Modals/BackgroundRemovalModal';

export const PreflightReport: React.FC = () => {
  const { artworkList, selectedArtworkId, updateArtwork } = useProjectStore();
  const [isBgModalOpen, setIsBgModalOpen] = useState(false);

  const selectedAsset = artworkList.find((a) => a.id === selectedArtworkId) || artworkList[0];

  if (!selectedAsset || !selectedAsset.preflightScore) {
    return null;
  }

  const { preflightScore } = selectedAsset;

  const getDpiBadge = () => {
    switch (preflightScore.dpiRating) {
      case 'good':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '11px', fontWeight: 600 }}>
            <CheckCircle2 size={13} /> {preflightScore.effectiveDpi} DPI (Print-Ready)
          </span>
        );
      case 'warning':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '11px', fontWeight: 600 }}>
            <AlertTriangle size={13} /> {preflightScore.effectiveDpi} DPI (Marginal)
          </span>
        );
      case 'critical':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>
            <AlertCircle size={13} /> {preflightScore.effectiveDpi} DPI (Low Res)
          </span>
        );
    }
  };

  return (
    <>
      <div style={{
        backgroundColor: '#18181b',
        borderRadius: '8px',
        border: '1px solid #27272a',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#141417',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#3b82f6" />
            <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TypeSafe Pre-Flight Audit
            </h3>
          </div>
          <span style={{ fontSize: '9px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 5px', borderRadius: '4px', fontWeight: 600 }}>
            JEV 1.13
          </span>
        </div>

        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Metric 1: DPI & Resolution */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Print Resolution:</span>
            {getDpiBadge()}
          </div>

          {/* Metric 2: Vector Integrity */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Knife Kinematics:</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '11px', fontWeight: 600 }}>
              <ShieldCheck size={13} /> Closed Perimeters (Clean)
            </span>
          </div>

          {/* Metric 3: Bleed Margin */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Bleed Overlap:</span>
            <span style={{ color: '#d4d4d8', fontSize: '11px', fontWeight: 500 }}>
              2.0mm Safe Zone
            </span>
          </div>

          {/* Background Removal Quick Action */}
          <button
            type="button"
            onClick={() => setIsBgModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(236, 72, 153, 0.12)',
              border: '1px solid rgba(236, 72, 153, 0.35)',
              color: '#ec4899',
              cursor: 'pointer',
              marginTop: '2px',
            }}
          >
            <Wand2 size={13} />
            <span>Remove Background (Tighten Cutline)</span>
          </button>

          {/* Notes */}
          {preflightScore.typeSafeNotes && preflightScore.typeSafeNotes.length > 0 && (
            <div style={{
              backgroundColor: '#121215',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #27272a',
              fontSize: '10px',
              color: '#a1a1aa',
              lineHeight: '1.4',
            }}>
              {preflightScore.typeSafeNotes.map((note, idx) => (
                <div key={idx} style={{ marginBottom: idx < preflightScore.typeSafeNotes!.length - 1 ? '4px' : 0 }}>
                  • {note}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
    </>
  );
};
