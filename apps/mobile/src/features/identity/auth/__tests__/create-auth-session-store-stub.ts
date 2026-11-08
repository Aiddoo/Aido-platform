import type { AuthStatus } from '@src/core/session/auth-status';

import { type AuthSessionStore, createAuthSessionStore } from '../apis/auth-session.store';
import type { AuthSessionState } from '../domains/auth-session.model';

function createAuthSessionState(status: AuthStatus): AuthSessionState {
  return status === 'unauthenticated' ? { status, reason: 'none' } : { status };
}

export function createAuthSessionStoreStub(initialStatus: AuthStatus = 'authenticated') {
  let store = createAuthSessionStore(createAuthSessionState(initialStatus));
  const listeners = new Set<() => void>();

  const stub: AuthSessionStore & { setStatus(status: AuthStatus): void } = {
    getState: () => store.getState(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (event) => {
      store.dispatch(event);
      listeners.forEach((listener) => listener());
    },
    setStatus: (status) => {
      store = createAuthSessionStore(createAuthSessionState(status));
      listeners.forEach((listener) => listener());
    },
  };
  return stub;
}
