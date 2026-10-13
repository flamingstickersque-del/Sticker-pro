import React, { useState } from 'react';
import {
  Upload,
  Maximize,
  Sliders,
  FileSpreadsheet,
  Grid,
  Target,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ArtworkManagerStep } from './ArtworkManagerStep';
import { StickerConfigStep } from './StickerConfigStep';
import { ContourConfigStep } from './ContourConfigStep';
import { MediaConfigStep } from './MediaConfigStep';
import { NestingConfigStep } from './NestingConfigStep';
import { RegistrationConfigStep } from './RegistrationConfigStep';

interface AccordionSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

export const LeftSidebar: React.FC = () => {
  // Allow multiple or active sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    artwork: true,
    sticker: true,
    contour: false,
    media: false,
    nesting: false,
    registration: false,
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const sections: AccordionSection[] = [
    {
      id: 'artwork',
      title: '1. Artwork Upload',
      icon: <Upload size={14} color="#ec4899" />,
      component: <ArtworkManagerStep />,
    },
    {
      id: 'sticker',
      title: '2. Sticker Configuration',
      icon: <Maximize size={14} color="#3b82f6" />,
      component: <StickerConfigStep />,
    },
    {
      id: 'contour',
      title: '3. Cut Contour & Smoothing',
      icon: <Sliders size={14} color="#ec4899" />,
      component: <ContourConfigStep />,
    },
    {
      id: 'media',
      title: '4. Media & Dimensions',
      icon: <FileSpreadsheet size={14} color="#10b981" />,
      component: <MediaConfigStep />,
    },
    {
      id: 'nesting',
      title: '5. Spacing & Auto Nesting',
      icon: <Grid size={14} color="#f59e0b" />,
      component: <NestingConfigStep />,
    },
    {
      id: 'registration',
      title: '6. Registration Marks (FC8600)',
      icon: <Target size={14} color="#10b981" />,
      component: <RegistrationConfigStep />,
    },
  ];

  return (
    <aside style={{
      width: '320px',
      backgroundColor: '#121215',
      borderRight: '1px solid #27272a',
      height: 'calc(100vh - 48px - 32px)',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #27272a', backgroundColor: '#18181b' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 700, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Production Setup Workflow
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sections.map((section) => {
          const isOpen = openSections[section.id];
          return (
            <div key={section.id} style={{ borderBottom: '1px solid #27272a' }}>
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isOpen ? '#18181b' : 'transparent',
                  border: 'none',
                  color: isOpen ? '#ffffff' : '#d4d4d8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {section.icon}
                  <span>{section.title}</span>
                </div>
                {isOpen ? <ChevronDown size={14} color="#a1a1aa" /> : <ChevronRight size={14} color="#71717a" />}
              </button>

              {isOpen && (
                <div style={{ padding: '14px', backgroundColor: '#141417' }}>
                  {section.component}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
