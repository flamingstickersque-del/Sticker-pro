import React, { useState } from 'react';
import {
  Scissors,
  FilePlus,
  FolderOpen,
  Save,
  RotateCcw,
  RotateCw,
  FileDown,
  Sparkles,
  Play,
  LogOut,
  User as UserIcon,
  Cloud,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProjectStore } from '../../store/useProjectStore';
import { ZoomControls } from './ZoomControls';
import { ExportModal } from './ExportModal';
import { CuttingMasterModal } from '../Modals/CuttingMasterModal';
import { SupportAssistantModal } from '../Assistant/SupportAssistantModal';
import { CloudProjectsModal } from '../Modals/CloudProjectsModal';
import { saveFile, openProjectDialog } from '../../services/desktopSave';

export const AppHeader: React.FC = () => {
  const {
    projectName,
    setProjectName,
    unit,
    setUnit,
    recalculateNesting,
  } = useProjectStore();

  const { user, logout } = useAuth();

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCM5Open, setIsCM5Open] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isCloudOpen, setIsCloudOpen] = useState(false);
  const fileInputProjectRef = React.useRef<HTMLInputElement>(null);

  const handleNewProject = () => {
    if (window.confirm('Create a new project? Current unsaved layout will be reset.')) {
      window.location.reload();
    }
  };

  const loadProjectFromJson = (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (data && data.artworkList && Array.isArray(data.artworkList)) {
        useProjectStore.getState().loadProject(data);
      } else {
        alert('Invalid project file: missing required project data.');
      }
    } catch (err) {
      console.error('Failed to parse project file:', err);
      alert('Failed to parse project file.');
    }
  };

  const handleOpenProject = async () => {
    const content = await openProjectDialog();
    if (content) {
      loadProjectFromJson(content);
      return;
    }
    // Fallback for browser mode if dialog wasn't invoked
    fileInputProjectRef.current?.click();
  };

  const handleSaveProject = async () => {
    const state = useProjectStore.getState();
    const projectData = {
      version: '1.0',
      projectName: state.projectName,
      unit: state.unit,
      artworkList: state.artworkList,
      contourConfig: state.contourConfig,
      mediaConfig: state.mediaConfig,
      nestingConfig: state.nestingConfig,
      registrationConfig: state.registrationConfig,
    };

    const jsonString = JSON.stringify(projectData, null, 2);
    await saveFile(jsonString, `${state.projectName}.stickerproj`, 'application/json');
  };

  return (
    <>
      <header style={{
        height: '48px',
        backgroundColor: '#121215',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 50,
      }}>
        {/* Left: Branding & Project Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #FF007F, #7928CA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(255, 0, 127, 0.4)',
            }}>
              <Scissors size={16} color="#FFFFFF" />
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.3px', color: '#FFFFFF' }}>
                StickerCut <span style={{ color: '#ec4899', fontSize: '11px', fontWeight: 600 }}>PRO</span>
              </span>
            </div>
          </div>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#27272a' }} />

          {/* Project Name Editor */}
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d4d4d8',
              fontSize: '13px',
              fontWeight: 500,
              width: '180px',
              outline: 'none',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
            placeholder="Project Name..."
          />

          {/* Quick File Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button className="btn-icon" onClick={handleNewProject} title="New Project">
              <FilePlus size={15} />
            </button>
            <button className="btn-icon" onClick={handleOpenProject} title="Open Project (.stickerproj)">
              <FolderOpen size={15} />
            </button>
            <button className="btn-icon" onClick={handleSaveProject} title="Save Project (.stickerproj)">
              <Save size={15} />
            </button>
            <button className="btn-icon" onClick={() => setIsCloudOpen(true)} title="Cloud Production Vault (Firestore)">
              <Cloud size={15} color="#ec4899" />
            </button>
            <input
              ref={fileInputProjectRef}
              type="file"
              accept=".stickerproj,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  file.text().then(loadProjectFromJson);
                }
              }}
            />
          </div>
        </div>

        {/* Center: Zoom Controls & Unit Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ZoomControls />

          {/* Unit Switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: '#18181b',
            borderRadius: '6px',
            border: '1px solid #27272a',
            padding: '2px',
          }}>
            <button
              onClick={() => setUnit('mm')}
              style={{
                background: unit === 'mm' ? '#ec4899' : 'transparent',
                color: unit === 'mm' ? '#FFFFFF' : '#a1a1aa',
                border: 'none',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              MM
            </button>
            <button
              onClick={() => setUnit('in')}
              style={{
                background: unit === 'in' ? '#ec4899' : 'transparent',
                color: unit === 'in' ? '#FFFFFF' : '#a1a1aa',
                border: 'none',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              IN
            </button>
          </div>
        </div>

        {/* Right: TypeSafe Badge & Export Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setIsAssistantOpen(true)}
            title="Open TypeSafe Technical Support & Workflow Assistant"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              color: '#60a5fa',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.22)';
              e.currentTarget.style.borderColor = '#60a5fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
            }}
          >
            <Sparkles size={13} color="#3b82f6" />
            <span>TypeSafe Assistant</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCM5Open(true)}
            title="Cutting Master 5 Plugin Integration (Graphtec FC9000 / FC8600)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11.5px',
              color: '#10b981',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
            }}
          >
            <Play size={12} fill="#10b981" />
            <span>⚡ Cutting Master 5</span>
          </button>

          <button className="btn-primary" onClick={() => setIsExportOpen(true)}>
            <FileDown size={14} />
            <span>Export Production</span>
          </button>

          {/* User Status & Sign Out */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '2px' }}>
              <div style={{ width: '1px', height: '18px', backgroundColor: '#27272a' }} />
              <div
                title={user.email || 'Operator'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: '#a1a1aa',
                  fontSize: '11.5px',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <UserIcon size={13} color="#71717a" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email?.split('@')[0] || 'Operator'}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of StickerCut PRO"
                className="btn-icon"
                style={{
                  color: '#ef4444',
                  padding: '5px',
                  borderRadius: '6px',
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
      <CuttingMasterModal isOpen={isCM5Open} onClose={() => setIsCM5Open(false)} />
      <SupportAssistantModal isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
      <CloudProjectsModal isOpen={isCloudOpen} onClose={() => setIsCloudOpen(false)} />
    </>
  );
};
