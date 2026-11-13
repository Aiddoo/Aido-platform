import type { AuthStatus } from '@src/core/session/auth-status';

import type { AuthSessionState } from '../domains/auth-session.model';
import { type AuthSessionStore, createAuthSessionStore } from '../stores/auth-session.store';

function createAuthSessionState(status: AuthStatus): AuthSessionState {
  return status === 'unauthenticated' ? { status, reason: 'none' } : { status };
}

/** 화면 테스트가 원하는 상태를 바로 만든다. 전이 규칙은 모델 테스트가 본다 */
export function createAuthSessionStoreStub(initialStatus: AuthStatus = 'authenticated') {
  let store = createAuthSessionStore(createAuthSessionState(initialStatus));
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());
  const stub: AuthSessionStore & { setStatus(status: AuthStatus): void } = {
    getSnapshot: () => store.getSnapshot(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    resolveBoot: (status) => {
      store.resolveBoot(status);
      notify();
    },
    failBoot: () => {
      store.failBoot();
      notify();
    },
    signIn: () => {
      store.signIn();
      notify();
    },
    signOut: () => {
      store.signOut();
      notify();
    },
    expire: () => {
      store.expire();
      notify();
    },
    setStatus: (status) => {
      store = createAuthSessionStore(createAuthSessionState(status));
      notify();
    },
  };
  return stub;
}
