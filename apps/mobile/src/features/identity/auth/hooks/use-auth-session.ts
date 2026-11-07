import { useAuthSessionStore, useSessionCleanupService } from '@src/bootstrap/providers/di-context';

/** 사용자의 로그인과 로그아웃을 세션에 알린다. 정리는 전환이 커밋된 뒤 부팅 훅이 맡는다 */
export function useAuthSession() {
  const store = useAuthSessionStore();
  const sessionCleanupService = useSessionCleanupService();

  return {
    signIn: () => {
      if (store.getState().status !== 'authenticated') {
        sessionCleanupService.beforeSignIn();
      }
      store.dispatch({ type: 'signedIn' });
    },
    signOut: () => store.dispatch({ type: 'signedOut' }),
  };
}
