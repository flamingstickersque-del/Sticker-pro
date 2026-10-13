import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  Trash2,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProjectStore } from '../../store/useProjectStore';
import {
  listUserCloudProjects,
  saveProjectToFirestore,
  loadProjectFromFirestore,
  deleteProjectFromFirestore,
  CloudProjectSummary,
} from '../../services/firebaseBackend';

interface CloudProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudProjectsModal: React.FC<CloudProjectsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const store = useProjectStore();

  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const list = await listUserCloudProjects(user.uid);
      setProjects(list);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to retrieve projects from Cloud Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchProjects();
      setActionSuccess(null);
      setErrorMessage(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSaveCurrentProject = async () => {
    if (!user) return;
    setSaving(true);
    setErrorMessage(null);
    setActionSuccess(null);

    try {
      const state = useProjectStore.getState();
      const payload = {
        projectName: state.projectName,
        unit: state.unit,
        artworkList: state.artworkList,
        contourConfig: state.contourConfig,
        mediaConfig: state.mediaConfig,
        nestingConfig: state.nestingConfig,
        registrationConfig: state.registrationConfig,
      };

      const result = await saveProjectToFirestore(user.uid, payload, activeProjectId || undefined);
      setActiveProjectId(result.projectId);
      setActionSuccess(`Project "${state.projectName}" saved to Cloud Firestore successfully!`);
      await fetchProjects();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error saving project to Cloud Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadProject = async (proj: CloudProjectSummary) => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const data = await loadProjectFromFirestore(user.uid, proj.id);
      store.loadProject(data);
      setActiveProjectId(proj.id);
      setActionSuccess(`Loaded "${proj.projectName}" into active workspace.`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load project from Cloud Firestore.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (proj: CloudProjectSummary) => {
    if (!user) return;
    if (!window.confirm(`Are you sure you want to delete "${proj.projectName}" from Cloud Firestore?`)) {
      return;
    }

    try {
      await deleteProjectFromFirestore(user.uid, proj.id);
      if (activeProjectId === proj.id) {
        setActiveProjectId(null);
      }
      setProjects((prev) => prev.filter((p) => p.id !== proj.id));
      setActionSuccess(`Deleted "${proj.projectName}" from Cloud Firestore.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete project.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        backgroundColor: '#121215',
        border: '1px solid #27272a',
        borderRadius: '12px',
        width: '680px',
        maxWidth: '92vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(236, 72, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Cloud size={18} color="#ec4899" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
                Cloud Production Vault
              </h2>
              <span style={{ fontSize: '11.5px', color: '#71717a' }}>
                Firebase Firestore & Cloudinary Artwork CDN
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Banner */}
        <div style={{
          padding: '14px 20px',
          backgroundColor: '#18181b',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div>
            <span style={{ fontSize: '12.5px', color: '#d4d4d8', fontWeight: 500 }}>
              Current Workspace: <strong style={{ color: '#FFFFFF' }}>{store.projectName}</strong>
            </span>
            <span style={{ display: 'block', fontSize: '11px', color: '#71717a' }}>
              {store.artworkList.length} artwork assets • {store.layoutResult.instances.length} stickers placed
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveCurrentProject}
            disabled={saving}
            className="btn-primary"
            style={{
              fontSize: '12.5px',
              padding: '7px 14px',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
            <span>{saving ? 'Syncing to Cloud...' : 'Save Current to Cloud'}</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {actionSuccess && (
          <div style={{
            margin: '12px 20px 0',
            padding: '8px 12px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#34d399',
            fontSize: '12px',
          }}>
            <CheckCircle2 size={15} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {errorMessage && (
          <div style={{
            margin: '12px 20px 0',
            padding: '8px 12px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#f87171',
            fontSize: '12px',
          }}>
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Projects List */}
        <div style={{
          padding: '16px 20px',
          flex: 1,
          overflowY: 'auto',
          minHeight: '220px',
        }}>
          {loading && projects.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '180px',
              color: '#71717a',
              gap: '10px',
            }}>
              <Loader2 size={24} className="animate-spin" color="#ec4899" />
              <span style={{ fontSize: '12px' }}>Querying Cloud Firestore vault...</span>
            </div>
          ) : projects.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '36px 20px',
              color: '#71717a',
            }}>
              <Cloud size={36} color="#3f3f46" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#a1a1aa', margin: '0 0 4px' }}>
                No projects saved in the Cloud Vault yet
              </p>
              <p style={{ fontSize: '12px', color: '#71717a', margin: 0 }}>
                Click "Save Current to Cloud" above to securely store your job and assets in Firestore.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {projects.map((proj) => {
                const isCurrent = activeProjectId === proj.id;
                const formattedDate = proj.updatedAt
                  ? proj.updatedAt.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Recent';

                return (
                  <div
                    key={proj.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      backgroundColor: isCurrent ? 'rgba(236, 72, 153, 0.08)' : '#18181b',
                      border: `1px solid ${isCurrent ? '#ec4899' : '#27272a'}`,
                      borderRadius: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#FFFFFF' }}>
                          {proj.projectName}
                        </span>
                        {isCurrent && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            backgroundColor: 'rgba(236, 72, 153, 0.2)',
                            color: '#ec4899',
                            borderRadius: '4px',
                          }}>
                            Active
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#71717a' }}>
                          <Clock size={11} /> {formattedDate}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#71717a' }}>
                          <Layers size={11} /> {proj.artworkCount} graphics ({proj.totalInstances} stickers)
                        </span>
                        <span style={{ fontSize: '11px', color: '#71717a' }}>
                          {proj.mediaDimensions}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleLoadProject(proj)}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '11.5px' }}
                        title="Load into workspace"
                      >
                        <FolderOpen size={13} />
                        <span>Load</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProject(proj)}
                        className="btn-icon"
                        style={{ color: '#ef4444', padding: '6px' }}
                        title="Delete project"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '10px 20px',
          backgroundColor: '#0e0e11',
          borderTop: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#71717a',
        }}>
          <span>Backend: Cloud Firestore (sticker-app-3e4e7) • Artwork CDN: Cloudinary (imx5euju)</span>
          <button
            type="button"
            onClick={fetchProjects}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              fontSize: '11px',
              textDecoration: 'underline',
            }}
          >
            Refresh Vault
          </button>
        </div>
      </div>
    </div>
  );
};
