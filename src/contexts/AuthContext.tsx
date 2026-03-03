/**
 * AuthContext - Centralized authentication state management
 * 
 * Provides:
 * - User authentication state (isAuthenticated, user info, role)
 * - Login/logout functions
 * - Role-based access control (hasRoleAccess)
 * - Session management and restoration
 * 
 * Extracted from App.tsx to enable route-based authentication
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  authenticateUser,
  clearSession,
  getStoredUser,
  hasActiveSession,
  verifySession,
  checkUserRole,
  LoginErrorCodes,
  type LoginUser,
} from '../services/gasLoginService';
import {
  logLogin,
  logLogout,
} from '../services/gasSystemToolsService';
import { clearUserProfileCache } from '../services/localStorageCache';
import { toast } from 'sonner';
import { determineRoleChangeType, type RoleChangeType } from '../components/CacheRefreshModals';

function inferRoleLevel(roleValue: string): number {
  const role = String(roleValue || '').toLowerCase().trim();
  if (!role) return 0;
  if (role === 'banned' || role === 'suspended') return 0;
  if (role.includes('auditor')) return 10;
  if (role.includes('admin')) return 8;
  if (role.includes('founder')) return 6;
  if (role.includes('president') || role === 'head' || role === 'officer') return 5;
  if (role === 'member' || role === 'volunteer') return 2;
  if (role === 'guest') return 1;
  return 2;
}

export interface AuthUser {
  name: string;
  username: string;
  email: string;
  idCode: string;
  position: string;
  profilePicture: string;
  role: string;
}

export interface RoleChangeInfo {
  changeType: RoleChangeType;
  oldRole: string;
  newRole: string;
}

interface AuthContextType {
  // State
  isAuthenticated: boolean;
  user: AuthUser | null;
  userRole: string;
  sessionChecked: boolean;
  isLoading: boolean;
  
  // Role change modal state
  showRoleChangeModal: boolean;
  roleChangeInfo: RoleChangeInfo | null;
  
  // Actions
  login: (username: string, password: string, rememberMe: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  continueSession: () => Promise<boolean>;
  hasRoleAccess: (requiredRoles: string[] | undefined) => boolean;
  
  // Role change handlers
  dismissRoleChange: () => void;
  confirmRoleChange: () => Promise<void>;
  
  // For components that need to update user info
  refreshUserInfo: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Remembered username helpers (for login form)
const RECENT_USERNAMES_KEY = 'ysp_recent_usernames';
const REMEMBERED_USERNAME_KEY = 'ysp_remembered_username';

function recordRecentUsername(username: string) {
  try {
    const stored = localStorage.getItem(RECENT_USERNAMES_KEY);
    const usernames: string[] = stored ? JSON.parse(stored) : [];
    const filtered = usernames.filter(u => u !== username);
    filtered.unshift(username);
    localStorage.setItem(RECENT_USERNAMES_KEY, JSON.stringify(filtered.slice(0, 5)));
  } catch {
    // Ignore storage errors
  }
}

function recordRememberedUsername(username: string, remember: boolean) {
  try {
    if (remember) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
    } else {
      localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

interface AuthProviderProps {
  children: ReactNode;
  onCacheClearRequest?: () => void;
}

export function AuthProvider({ children, onCacheClearRequest }: AuthProviderProps) {
  // Core auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('guest');
  const [user, setUser] = useState<AuthUser | null>(null);
  
  // Role change modal state
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [roleChangeInfo, setRoleChangeInfo] = useState<RoleChangeInfo | null>(null);
  const roleCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear all user state
  const clearUserState = useCallback(() => {
    setIsAuthenticated(false);
    setUserRole('guest');
    setUser(null);
  }, []);

  // Set user state from LoginUser
  const setUserFromLogin = useCallback((loginUser: LoginUser) => {
    setIsAuthenticated(true);
    setUserRole(loginUser.role);
    setUser({
      name: loginUser.name,
      username: loginUser.username,
      email: loginUser.email || '',
      idCode: loginUser.id || '',
      position: loginUser.position || '',
      profilePicture: loginUser.profilePic || '',
      role: loginUser.role,
    });
  }, []);

  // Role-based access check
  const hasRoleAccess = useCallback((requiredRoles: string[] | undefined): boolean => {
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const userLevel = inferRoleLevel(userRole);
    return requiredRoles.some((requiredRole) => {
      const requiredLevel = inferRoleLevel(requiredRole);
      return userLevel >= requiredLevel;
    });
  }, [userRole]);

  // Login function
  const login = useCallback(async (username: string, password: string, rememberMe: boolean): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const response = await authenticateUser(username, password);
      
      if (response.success && response.user) {
        const loginUser = response.user;
        
        // Handle BANNED accounts
        if (loginUser.role === 'banned') {
          toast.error('Account Banned', {
            description: 'This account has been permanently banned. Contact admin for assistance.',
          });
          setIsLoading(false);
          return false;
        }

        recordRecentUsername(username);
        recordRememberedUsername(username, rememberMe);

        // Handle SUSPENDED accounts
        if (loginUser.role === 'suspended') {
          setUserFromLogin(loginUser);
          toast.warning('Account Suspended', {
            description: 'Your account has limited access. Contact admin for full restoration.',
          });
          setIsLoading(false);
          return true;
        }

        // Normal login
        setUserFromLogin(loginUser);
        logLogin(loginUser.name || username, true);

        const roleMessages: Record<string, string> = {
          auditor: 'Welcome, Auditor! You have full system access including audit logs.',
          admin: 'Welcome, Admin! You have full management access.',
          officer: 'Welcome, Officer! You have leadership access.',
          head: 'Welcome, Committee Head! You have leadership access.',
          member: 'Welcome, Member! You have standard access.',
          guest: 'Welcome, Guest! You have limited viewing access.',
        };

        toast.success('Successfully logged in!', {
          description: roleMessages[loginUser.role] || `Welcome, ${loginUser.name}!`,
        });
        
        setIsLoading(false);
        return true;
      }
      
      setIsLoading(false);
      return false;
    } catch (error: unknown) {
      logLogin(username, false);
      
      if (error && typeof error === 'object' && 'code' in error) {
        const loginError = error as { code: string; message: string };
        
        switch (loginError.code) {
          case LoginErrorCodes.INVALID_CREDENTIALS:
            toast.error('Invalid credentials', {
              description: 'Please check your username and password',
            });
            break;
          case LoginErrorCodes.ACCOUNT_BANNED:
            toast.error('Account Banned', {
              description: loginError.message || 'This account has been permanently banned.',
            });
            break;
          case LoginErrorCodes.TIMEOUT_ERROR:
            toast.error('Connection Timeout', {
              description: 'The server is taking too long to respond. Please try again.',
            });
            break;
          case LoginErrorCodes.NETWORK_ERROR:
            toast.error('Network Error', {
              description: 'Unable to connect to the server. Please check your internet connection.',
            });
            break;
          case LoginErrorCodes.NO_API_URL:
            toast.error('Service Unavailable', {
              description: 'Login service is not configured. Please contact administrator.',
            });
            break;
          default:
            toast.error('Login Failed', {
              description: loginError.message || 'An unexpected error occurred. Please try again.',
            });
        }
      } else {
        toast.error('Login Failed', {
          description: 'An unexpected error occurred. Please try again.',
        });
      }
      
      setIsLoading(false);
      return false;
    }
  }, [setUserFromLogin]);

  // Continue existing session
  const continueSession = useCallback(async (): Promise<boolean> => {
    const storedUser = getStoredUser();
    if (!storedUser || !hasActiveSession()) {
      toast.error('Session not available', {
        description: 'Please log in with your username and password.',
      });
      return false;
    }

    setIsLoading(true);
    
    try {
      const valid = await verifySession();
      if (!valid) {
        if (storedUser.username) {
          clearUserProfileCache(storedUser.username);
        }
        clearSession();
        toast.error('Session expired', {
          description: 'Please log in again.',
        });
        setIsLoading(false);
        return false;
      }

      setUserFromLogin(storedUser);
      toast.success('Welcome back!', {
        description: storedUser.name ? `Signed in as ${storedUser.name}` : 'Signed in.',
      });
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('[AuthContext] Session verification failed:', error);
      if (storedUser.username) {
        clearUserProfileCache(storedUser.username);
      }
      clearSession();
      toast.error('Session check failed', {
        description: 'Please log in again.',
      });
      setIsLoading(false);
      return false;
    }
  }, [setUserFromLogin]);

  // Logout function
  const logout = useCallback(async () => {
    const toastId = toast.loading('Logging out...');
    
    try {
      if (user?.name) {
        // Wait for logout to be recorded in the backend
        await logLogout(user.name);
        
        const storedUser = getStoredUser();
        if (storedUser?.username) {
          clearUserProfileCache(storedUser.username);
        }
      }
      
      clearSession();
      clearUserState();
      toast.success('Successfully logged out', { id: toastId });
    } catch (error) {
      // Still logout even if logging fails
      clearSession();
      clearUserState();
      toast.success('Successfully logged out', { id: toastId });
    }
  }, [user, clearUserState]);

  // Refresh user info from storage
  const refreshUserInfo = useCallback(() => {
    const storedUser = getStoredUser();
    if (storedUser && hasActiveSession()) {
      setUserFromLogin(storedUser);
    }
  }, [setUserFromLogin]);

  // Role change handlers
  const dismissRoleChange = useCallback(() => {
    setShowRoleChangeModal(false);
  }, []);

  const confirmRoleChange = useCallback(async () => {
    setShowRoleChangeModal(false);
    
    if (roleChangeInfo?.newRole === 'banned') {
      const storedUser = getStoredUser();
      if (storedUser?.username) {
        clearUserProfileCache(storedUser.username);
      }
      clearSession();
      clearUserState();
      toast.error('Account access has been revoked');
      return;
    }
    
    // For other role changes, trigger cache clear
    if (onCacheClearRequest) {
      onCacheClearRequest();
    }
  }, [roleChangeInfo, clearUserState, onCacheClearRequest]);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedUser = getStoredUser();
      
      if (storedUser && hasActiveSession()) {
        setUserFromLogin(storedUser);
      }
      
      setSessionChecked(true);
    };
    
    restoreSession();
  }, [setUserFromLogin]);

  // Role checking polling (every 20 seconds when logged in)
  useEffect(() => {
    if (!isAuthenticated || userRole === 'guest' || !user?.name) {
      if (roleCheckIntervalRef.current) {
        clearInterval(roleCheckIntervalRef.current);
        roleCheckIntervalRef.current = null;
      }
      return;
    }

    const storedUser = getStoredUser();
    if (!storedUser?.username) return;

    let isMounted = true;

    const checkRole = async () => {
      if (!isMounted) return;
      
      try {
        const result = await checkUserRole(storedUser.username);
        
        if (!isMounted) return;
        
        if (result.success && result.role) {
          const currentStoredUser = getStoredUser();
          const currentRole = currentStoredUser?.role || userRole;
          
          if (result.role !== currentRole) {
            const changeType = determineRoleChangeType(currentRole, result.role);
            setRoleChangeInfo({
              changeType,
              oldRole: currentRole,
              newRole: result.role,
            });
            setShowRoleChangeModal(true);
            
            if (roleCheckIntervalRef.current) {
              clearInterval(roleCheckIntervalRef.current);
              roleCheckIntervalRef.current = null;
            }
          }
        }
      } catch (error) {
        console.warn('[AuthContext] Role polling error (ignored):', error);
      }
    };

    const initialTimeout = setTimeout(() => {
      if (isMounted) checkRole();
    }, 5000);

    roleCheckIntervalRef.current = setInterval(checkRole, 20000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      if (roleCheckIntervalRef.current) {
        clearInterval(roleCheckIntervalRef.current);
        roleCheckIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, userRole, user?.name]);

  const value: AuthContextType = {
    isAuthenticated,
    user,
    userRole,
    sessionChecked,
    isLoading,
    showRoleChangeModal,
    roleChangeInfo,
    login,
    logout,
    continueSession,
    hasRoleAccess,
    dismissRoleChange,
    confirmRoleChange,
    refreshUserInfo,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

