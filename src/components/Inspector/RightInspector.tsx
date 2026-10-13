import React from 'react';
import { YieldCard } from './YieldCard';
import { PreflightReport } from './PreflightReport';
import { LayerManager } from './LayerManager';

export const RightInspector: React.FC = () => {
  return (
    <aside style={{
      width: '300px',
      backgroundColor: '#121215',
      borderLeft: '1px solid #27272a',
      height: 'calc(100vh - 48px - 32px)',
      minHeight: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '14px',
      flexShrink: 0,
    }}>
      <div style={{ flexShrink: 0 }}>
        <YieldCard />
      </div>
      <div style={{ flexShrink: 0 }}>
        <PreflightReport />
      </div>
      <div style={{ flexShrink: 0 }}>
        <LayerManager />
      </div>
    </aside>
  );
};
