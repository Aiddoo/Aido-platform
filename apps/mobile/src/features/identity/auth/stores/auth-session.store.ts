import type { ResolvedAuthStatus } from '@src/core/session/auth-status';
import { isEqual } from 'es-toolkit';

import {
  type AuthSessionEvent,
  AuthSessionPolicy,
  type AuthSessionState,
} from '../domains/auth-session.model';

export interface AuthSessionStore {
  getSnapshot(): AuthSessionState;
  subscribe(listener: () => void): () => void;
  resolveBoot(status: ResolvedAuthStatus): void;
  failBoot(): void;
  signIn(): void;
  signOut(): void;
  expire(): void;
}

/** 값을 동기로 읽을 수 있어 커밋 전에 도착한 만료 이벤트도 지금 상태로 판정한다. DI가 소유한다 */
export function createAuthSessionStore(
  initialState: AuthSessionState = { status: 'loading' },
): AuthSessionStore {
  let state = initialState;
  const listeners = new Set<() => void>();

  const transition = (event: AuthSessionEvent) => {
    const next = AuthSessionPolicy.transitionAuthSession(state, event);
    if (isEqual(next, state)) {
      return;
    }
    state = next;
    for (const listener of Array.from(listeners)) {
      listener();
    }
  };

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    resolveBoot: (status) => transition({ type: 'bootResolved', status }),
    failBoot: () => transition({ type: 'bootFailed' }),
    signIn: () => transition({ type: 'signedIn' }),
    signOut: () => transition({ type: 'signedOut' }),
    expire: () => transition({ type: 'sessionExpired' }),
  };
}
