import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Start as loading
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false); // Start as not checked
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  // Mock user for local development
  useEffect(() => {
    // Simulate async auth check
    setTimeout(() => {
      const mockUser = {
        id: '6a82fcc8dd23ed146cdc7a8f', // Real user ID from database
        email: 'pph2shoaib@gmail.com', // Real email from database
        role: 'admin',
        full_name: 'pph2shoaib'
      };
      
      setUser(mockUser);
      setIsAuthenticated(true);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
    }, 100); // Small delay to simulate auth check
  }, []);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      window.location.href = '/';
    }
  };

  const navigateToLogin = () => {
    // For local development, just reload
    window.location.href = '/';
  };

  const checkUserAuth = async () => {
    // Mock auth check - already done in useEffect
    setIsLoadingAuth(false);
    setAuthChecked(true);
  };

  const checkAppState = async () => {
    // Mock app state check
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
