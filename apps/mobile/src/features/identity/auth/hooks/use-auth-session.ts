import { useAuthSessionStore, useSessionCleanupService } from '@src/bootstrap/providers/di-context';

/** 정리는 전환이 커밋된 뒤 부팅 훅이 맡고, `signIn`은 아직 인증 전이면 지난 계정의 조회 캐시를 먼저 비운다 */
export function useAuthSession() {
  const store = useAuthSessionStore();
  const sessionCleanupService = useSessionCleanupService();

  return {
    signIn: () => {
      if (store.getSnapshot().status !== 'authenticated') {
        sessionCleanupService.beforeSignIn();
      }
      store.signIn();
    },
    signOut: () => store.signOut(),
  };
}
