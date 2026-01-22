import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useStorage } from './di-provider';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  setStatus: (status: AuthStatus) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const storage = useStorage();
  const [status, setStatusState] = useState<AuthStatus>('loading');

  // 앱 시작 시 토큰 확인
  useEffect(() => {
    const checkAuth = async () => {
      const token = await storage.get<string>('accessToken');
      console.log(token);
      setStatusState(token ? 'authenticated' : 'unauthenticated');
    };
    checkAuth();
  }, [storage]);

  const setStatus = useCallback((newStatus: AuthStatus) => {
    setStatusState(newStatus);
  }, []);

  return <AuthContext.Provider value={{ status, setStatus }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const useAuthStatus = () => useAuth().status;
export const useIsAuthenticated = () => useAuth().status === 'authenticated';
