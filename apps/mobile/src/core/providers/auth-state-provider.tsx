import { TokenStore } from '@src/shared/storage/token-store';
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useState,
} from 'react';

// ===== Types =====

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
}

interface AuthStateContextValue extends AuthState {
  setAuthenticated: (value: boolean) => void;
  initialize: () => Promise<void>;
  clearAuth: () => void;
}

export const AuthStateContext = createContext<AuthStateContextValue | null>(null);

export const AuthStateProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isInitialized: false,
  });

  const initialize = useCallback(async () => {
    try {
      await TokenStore.initialize();
      const token = await TokenStore.getAccessToken();

      setState({
        isAuthenticated: !!token,
        isInitialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
      setState({
        isAuthenticated: false,
        isInitialized: true,
      });
    }
  }, []);

  const setAuthenticated = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isAuthenticated: value }));
  }, []);

  const clearAuth = useCallback(() => {
    setState((prev) => ({ ...prev, isAuthenticated: false }));
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const value: AuthStateContextValue = {
    ...state,
    setAuthenticated,
    initialize,
    clearAuth,
  };

  return <AuthStateContext value={value}>{children}</AuthStateContext>;
};

/**
 * @example
 * const { isAuthenticated, isInitialized } = useAuthState();
 *
 * if (!isInitialized) return <LoadingScreen />;
 * return isAuthenticated ? <AppScreens /> : <AuthScreens />;
 */
export const useAuthState = (): AuthStateContextValue => {
  const context = use(AuthStateContext);

  if (!context) {
    throw new Error('useAuthState must be used within AuthStateProvider');
  }

  return context;
};
