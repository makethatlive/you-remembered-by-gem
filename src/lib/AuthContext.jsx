import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  // Check for stored JWT token and validate on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('access_token');
      
      if (token) {
        try {
          // Set token in API client
          base44.auth.setToken(token);
          
          // Validate token by fetching user profile
          const userProfile = await base44.auth.me();
          setUser(userProfile);
          setIsAuthenticated(true);
        } catch (err) {
          console.error('Session validation failed:', err);
          // Token is invalid or expired, clear it
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          base44.auth.clearToken();
        }
      }
      
      setAuthChecked(true);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
    };
    
    checkSession();
  }, []);

  const logout = async (shouldRedirect = true) => {
    try {
      // Call backend logout to invalidate session
      await base44.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    
    // Clear local state
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    base44.auth.clearToken();
    
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const login = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    // Token is already stored by Login.jsx, just update user state
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const checkUserAuth = async () => {
    // Auth check is already done in useEffect
    setIsLoadingAuth(false);
    setAuthChecked(true);
  };

  const checkAppState = async () => {
    // App state check placeholder
    setIsLoadingPublicSettings(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      login,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
