import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.ts';
import { apiRequest, getStoredToken, setStoredToken, removeStoredToken } from '../lib/api.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<any>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<any>;
  sendPasswordResetCode: (email: string) => Promise<any>;
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<any>;
  loginWithGoogle: (googleData: any) => Promise<void>;
  loginWithAdminCredentials: (email: string, password: string) => Promise<any>;
  loginWithTelegram: (telegramData: any) => Promise<void>;
  loginWithDevPersona: (userId: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoginModalOpen: boolean;
  openLoginModal: (onSuccess?: () => void) => void;
  closeLoginModal: () => void;
  isOnboardingOpen: boolean;
  openOnboardingModal: () => void;
  closeOnboardingModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [loginSuccessCallback, setLoginSuccessCallback] = useState<(() => void) | null>(null);

  const refreshUser = async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await apiRequest<User>('/api/auth/me');
      setUser(userData);

      // If user has not selected region and district yet, show onboarding
      if (!userData.region_id || !userData.district_id) {
        setIsOnboardingOpen(true);
      }
    } catch (err) {
      console.warn('Authentication token expired or invalid:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const _afterLogin = (res: { token: string; user: User; is_new?: boolean }) => {
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setIsLoginModalOpen(false);

    if (res.is_new || !res.user.region_id) {
      setIsOnboardingOpen(true);
    }

    if (loginSuccessCallback) {
      loginSuccessCallback();
      setLoginSuccessCallback(null);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User; is_admin?: boolean }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      _afterLogin(res);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User; is_new?: boolean }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      _afterLogin(res);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const sendPasswordResetCode = async (email: string) => {
    return apiRequest<{ success: boolean; message: string; simulated?: boolean; demo_code?: string }>(
      '/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
  };

  const resetPasswordWithCode = async (email: string, code: string, newPassword: string) => {
    return apiRequest<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });
  };

  const loginWithGoogle = async (googleData: any) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User; is_new: boolean }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify(googleData),
      });
      _afterLogin(res);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithAdminCredentials = async (email: string, password: string) => {
    return loginWithEmail(email, password);
  };

  const logout = () => {
    removeStoredToken();
    setToken(null);
    setUser(null);
  };

  const openLoginModal = (onSuccess?: () => void) => {
    if (onSuccess) setLoginSuccessCallback(() => onSuccess);
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setLoginSuccessCallback(null);
  };

  const openOnboardingModal = () => setIsOnboardingOpen(true);
  const closeOnboardingModal = () => setIsOnboardingOpen(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loginWithEmail,
        registerWithEmail,
        sendPasswordResetCode,
        resetPasswordWithCode,
        loginWithGoogle,
        loginWithAdminCredentials,
        loginWithTelegram: async () => {},
        loginWithDevPersona: async () => {},
        logout,
        refreshUser,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        isOnboardingOpen,
        openOnboardingModal,
        closeOnboardingModal,
      }}
    >
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
