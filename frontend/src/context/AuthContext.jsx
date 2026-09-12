import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Helper: a session is valid only when BOTH token and user are present
  const getInitialToken = () => {
    const saved = localStorage.getItem('link_x8_token') || localStorage.getItem('ner_logiai_token');
    // Reject the old hard-coded demo token that was auto-set
    if (!saved || saved === 'demo-jwt-token') {
      // Also purge orphaned user data so state stays consistent
      localStorage.removeItem('link_x8_token');
      localStorage.removeItem('link_x8_user');
      localStorage.removeItem('ner_logiai_token');
      localStorage.removeItem('ner_logiai_user');
      return null;
    }
    return saved;
  };

  const [token, setToken] = useState(getInitialToken);

  const [user, setUser] = useState(() => {
    // Only hydrate user if a valid token exists
    const savedToken = localStorage.getItem('link_x8_token') || localStorage.getItem('ner_logiai_token');
    if (!savedToken || savedToken === 'demo-jwt-token') return null;
    const saved = localStorage.getItem('link_x8_user') || localStorage.getItem('ner_logiai_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
          role: 'Viewer'
        };
        setToken(session.access_token);
        setUser(userData);
        localStorage.setItem('link_x8_token', session.access_token);
        localStorage.setItem('link_x8_user', JSON.stringify(userData));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
          role: 'Viewer'
        };
        setToken(session.access_token);
        setUser(userData);
        localStorage.setItem('link_x8_token', session.access_token);
        localStorage.setItem('link_x8_user', JSON.stringify(userData));
      } else if (event === 'SIGNED_OUT') {
        setToken(null);
        setUser(null);
        localStorage.removeItem('link_x8_token');
        localStorage.removeItem('link_x8_user');
        localStorage.removeItem('ner_logiai_token');
        localStorage.removeItem('ner_logiai_user');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { access_token, user: userData } = res.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('link_x8_token', access_token);
      localStorage.setItem('link_x8_user', JSON.stringify(userData));
      return { success: true };
    } catch (err) {
      setToken(null);
      setUser(null);
      localStorage.removeItem('link_x8_token');
      localStorage.removeItem('link_x8_user');
      localStorage.removeItem('ner_logiai_token');
      localStorage.removeItem('ner_logiai_user');
      const errorMsg = err.response?.data?.detail || err.message || 'Authentication failed';
      return { success: false, error: errorMsg };
    }
  };

  const loginWithMobile = async (mobile) => {
    // Mobile OTP demo auth — creates a demo user session
    const fallbackUser = {
      id: 2,
      email: `+91${mobile}@mobile.linkx8.in`,
      full_name: 'Mobile User',
      role: 'Viewer'
    };
    const demoToken = 'demo-mobile-token-' + Date.now();
    setToken(demoToken);
    setUser(fallbackUser);
    localStorage.setItem('link_x8_token', demoToken);
    localStorage.setItem('link_x8_user', JSON.stringify(fallbackUser));
    return { success: true };
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('link_x8_token');
    localStorage.removeItem('link_x8_user');
    localStorage.removeItem('ner_logiai_token');
    localStorage.removeItem('ner_logiai_user');
    await supabase.auth.signOut();
  };

  const switchRole = (newRole) => {
    const updated = { ...user, role: newRole };
    setUser(updated);
    localStorage.setItem('link_x8_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, loginWithMobile, loginWithGoogle, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
