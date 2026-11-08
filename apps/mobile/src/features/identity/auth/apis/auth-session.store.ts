import { isEqual } from 'es-toolkit';

import {
  type AuthSessionEvent,
  AuthSessionPolicy,
  type AuthSessionState,
} from '../domains/auth-session.model';

export interface AuthSessionStore {
  getState(): AuthSessionState;
  subscribe(listener: () => void): () => void;
  dispatch(event: AuthSessionEvent): void;
}

export function createAuthSessionStore(
  initialState: AuthSessionState = { status: 'loading' },
): AuthSessionStore {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (event) => {
      const next = AuthSessionPolicy.transitionAuthSession(state, event);
      if (isEqual(next, state)) {
        return;
      }
      state = next;
      for (const listener of Array.from(listeners)) {
        listener();
      }
    },
  };
}
