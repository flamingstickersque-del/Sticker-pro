import React, { useState } from 'react';
import { Scissors, AlertCircle, Loader2, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email or password is incorrect');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const res = await signUp(email, password);
        if (!res.success && res.error) {
          setError(res.error);
        }
      } else {
        const res = await signIn(email, password);
        if (!res.success && res.error) {
          setError(res.error);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = (signUpMode: boolean) => {
    setIsSignUp(signUpMode);
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#09090b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: '#121215',
        border: '1px solid #27272a',
        borderRadius: '12px',
        padding: '36px 32px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #FF007F, #7928CA)',
            boxShadow: '0 0 20px rgba(255, 0, 127, 0.4)',
            marginBottom: '14px',
          }}>
            <Scissors size={24} color="#FFFFFF" />
          </div>

          <h1 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-0.4px',
            margin: '0 0 4px 0',
          }}>
            StickerCut <span style={{ color: '#ec4899', fontSize: '16px' }}>PRO</span>
          </h1>
          <p style={{
            fontSize: '13px',
            color: '#71717a',
            margin: 0,
          }}>
            Print & Cut Sheet Production Studio
          </p>
        </div>

        {/* Auth Mode Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: '#18181b',
          borderRadius: '8px',
          padding: '3px',
          marginBottom: '22px',
          border: '1px solid #27272a',
        }}>
          <button
            type="button"
            onClick={() => toggleMode(false)}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: !isSignUp ? '#27272a' : 'transparent',
              color: !isSignUp ? '#FFFFFF' : '#71717a',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => toggleMode(true)}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isSignUp ? '#27272a' : 'transparent',
              color: isSignUp ? '#FFFFFF' : '#71717a',
              transition: 'all 0.15s ease',
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '20px',
            color: '#f87171',
            fontSize: '13px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: '#a1a1aa',
              marginBottom: '6px',
            }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#71717a',
                display: 'flex',
                alignItems: 'center',
              }}>
                <Mail size={15} />
              </div>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="operator@production.com"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#ec4899')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#27272a')}
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: '#a1a1aa',
              marginBottom: '6px',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#71717a',
                display: 'flex',
                alignItems: 'center',
              }}>
                <Lock size={15} />
              </div>
              <input
                type="password"
                required
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  backgroundColor: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#ec4899')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#27272a')}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: '8px',
              padding: '11px 16px',
              borderRadius: '6px',
              border: 'none',
              background: 'linear-gradient(135deg, #ec4899, #db2777)',
              color: '#FFFFFF',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
              </>
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Mode Switch Footer */}
        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '12.5px',
          color: '#71717a',
        }}>
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => toggleMode(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ec4899',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Sign in
              </button>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => toggleMode(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ec4899',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Sign up
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
