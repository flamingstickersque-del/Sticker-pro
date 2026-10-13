import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/Auth/AuthScreen';
import { AppHeader } from './components/Header/AppHeader';
import { LeftSidebar } from './components/Sidebar/LeftSidebar';
import { InteractiveCanvas } from './components/Canvas/InteractiveCanvas';
import { RightInspector } from './components/Inspector/RightInspector';
import { AppStatusBar } from './components/StatusBar/AppStatusBar';

const StudioDashboard: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: '#09090b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid #27272a',
            borderTopColor: '#ec4899',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 500 }}>
            Verifying session...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: '#09090b',
    }}>
      {/* 1. Header Toolbar */}
      <AppHeader />

      {/* 2. Main Studio Workspace */}
      <main style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* Left Step Accordion Sidebar */}
        <LeftSidebar />

        {/* Center Interactive Canvas Viewport */}
        <InteractiveCanvas />

        {/* Right Inspector & Layer Manager */}
        <RightInspector />
      </main>

      {/* 3. Bottom Production Status Bar */}
      <AppStatusBar />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <StudioDashboard />
    </AuthProvider>
  );
};

export default App;
