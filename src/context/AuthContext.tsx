import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.ts';
import { apiRequest, getStoredToken, setStoredToken, removeStoredToken } from '../lib/api.ts';

interface ProfileCompleteData {
  first_name?: string;
  last_name?: string;
  name?: string;
  phone: string;
  profile_photo_url: string;
  region_id: string;
  district_id: string;
  bio?: string;
  latitude?: number;
  longitude?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<any>;
  sendRegisterCode: (email: string) => Promise<any>;
  registerWithEmail: (email: string, code: string, password: string) => Promise<any>;
  sendPasswordResetCode: (email: string) => Promise<any>;
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<any>;
  loginWithGoogle: (googleData: any) => Promise<void>;
  loginWithAdminCredentials: (email: string, password: string) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  // Mandatory profile completion
  completeProfile: (data: ProfileCompleteData) => Promise<void>;
  isProfileModalOpen: boolean;
  profileCanSkip: boolean;
  openProfileModal: (canSkip?: boolean) => void;
  closeProfileModal: () => void;
  // Account linking
  sendLinkEmailCode: (email: string) => Promise<any>;
  verifyLinkEmail: (email: string, code: string) => Promise<any>;
  linkGoogle: (googleData: any) => Promise<any>;
  // Login modal
  isLoginModalOpen: boolean;
  openLoginModal: (onSuccess?: () => void) => void;
  closeLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileCanSkip, setProfileCanSkip] = useState(false);
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

      // Returning/refreshed session: prompt to complete profile if needed, but allow skip.
      if (userData.is_profile_complete === false) {
        setProfileCanSkip(true);
        setIsProfileModalOpen(true);
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

  // isNewAccount → hard gate (cannot skip). Existing account → soft (can skip).
  const _afterLogin = (res: { token: string; user: User; is_new?: boolean; needs_profile?: boolean }, isNewAccount?: boolean) => {
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
    setIsLoginModalOpen(false);

    const incomplete = res.user.is_profile_complete === false;
    if (incomplete) {
      const hard = isNewAccount ?? Boolean(res.is_new);
      setProfileCanSkip(!hard);
      setIsProfileModalOpen(true);
    } else {
      setIsProfileModalOpen(false);
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
      _afterLogin(res, false);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const sendRegisterCode = async (email: string) => {
    return apiRequest<{ success: boolean; message: string; simulated?: boolean; demo_code?: string }>(
      '/api/auth/register/send-code',
      { method: 'POST', body: JSON.stringify({ email }) }
    );
  };

  const registerWithEmail = async (email: string, code: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User; is_new?: boolean }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, code, password }),
      });
      _afterLogin(res, true);
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  const sendPasswordResetCode = async (email: string) => {
    return apiRequest<{ success: boolean; message: string; simulated?: boolean; demo_code?: string }>(
      '/api/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) }
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
      const res = await apiRequest<{ token: string; user: User; is_new: boolean; needs_profile?: boolean }>(
        '/api/auth/google',
        { method: 'POST', body: JSON.stringify(googleData) }
      );
      _afterLogin(res, res.is_new);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithAdminCredentials = async (email: string, password: string) => {
    return loginWithEmail(email, password);
  };

  const completeProfile = async (data: ProfileCompleteData) => {
    const res = await apiRequest<{ success: boolean; user: User }>('/api/auth/profile/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setUser(res.user);
    setIsProfileModalOpen(false);
  };

  const sendLinkEmailCode = async (email: string) => {
    return apiRequest<{ success: boolean; message: string; simulated?: boolean; demo_code?: string }>(
      '/api/auth/email/send-code',
      { method: 'POST', body: JSON.stringify({ email }) }
    );
  };

  const verifyLinkEmail = async (email: string, code: string) => {
    const res = await apiRequest<{ success: boolean; user: User }>('/api/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    setUser(res.user);
    return res;
  };

  const linkGoogle = async (googleData: any) => {
    const res = await apiRequest<{ success: boolean; user: User }>('/api/auth/google/link', {
      method: 'POST',
      body: JSON.stringify(googleData),
    });
    setUser(res.user);
    return res;
  };

  const logout = () => {
    removeStoredToken();
    setToken(null);
    setUser(null);
    setIsProfileModalOpen(false);
  };

  const openLoginModal = (onSuccess?: () => void) => {
    if (onSuccess) setLoginSuccessCallback(() => onSuccess);
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setLoginSuccessCallback(null);
  };

  const openProfileModal = (canSkip = true) => {
    setProfileCanSkip(canSkip);
    setIsProfileModalOpen(true);
  };
  const closeProfileModal = () => setIsProfileModalOpen(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loginWithEmail,
        sendRegisterCode,
        registerWithEmail,
        sendPasswordResetCode,
        resetPasswordWithCode,
        loginWithGoogle,
        loginWithAdminCredentials,
        logout,
        refreshUser,
        completeProfile,
        isProfileModalOpen,
        profileCanSkip,
        openProfileModal,
        closeProfileModal,
        sendLinkEmailCode,
        verifyLinkEmail,
        linkGoogle,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
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
