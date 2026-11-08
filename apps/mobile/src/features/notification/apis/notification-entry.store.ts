import { MARKETING_OPT_OUT_ACTION } from '../constants/notification.constants';
import type { PendingNotificationResponse } from '../domains/notification.model';
import type { NotificationDestination } from '../utils/notification-destination';

interface NotificationEntryState {
  /** 아직 열지 못한 탭 하나. 마지막 탭이 이긴다 */
  pending: PendingNotificationResponse | null;
  ready: ReadyNotificationEntry | null;
  optOut: PendingNotificationResponse | null;
}

export interface ReadyNotificationEntry {
  response: PendingNotificationResponse;
  destination: NotificationDestination;
}

export interface NotificationEntryStore {
  getState(): NotificationEntryState;
  subscribe(listener: () => void): () => void;
  receive(response: PendingNotificationResponse): void;
  markReady(responseId: string, destination: NotificationDestination): void;
  settle(responseId: string): void;
  clear(): void;
}

const EMPTY_STATE: NotificationEntryState = { pending: null, ready: null, optOut: null };

export function createNotificationEntryStore(): NotificationEntryStore {
  let state = EMPTY_STATE;
  let lastSettledId: string | null = null;
  const listeners = new Set<() => void>();

  function setState(next: NotificationEntryState) {
    state = next;
    for (const listener of Array.from(listeners)) {
      listener();
    }
  }

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    receive: (response) => {
      if (
        response.id === lastSettledId ||
        response.id === state.pending?.id ||
        response.id === state.ready?.response.id ||
        response.id === state.optOut?.id
      ) {
        return;
      }
      setState(
        response.actionIdentifier === MARKETING_OPT_OUT_ACTION
          ? { ...state, optOut: response }
          : { ...state, pending: response, ready: null },
      );
    },
    markReady: (responseId, destination) => {
      if (state.pending?.id !== responseId) {
        return;
      }
      setState({ ...state, pending: null, ready: { response: state.pending, destination } });
    },
    settle: (responseId) => {
      lastSettledId = responseId;
      setState({
        pending: state.pending?.id === responseId ? null : state.pending,
        ready: state.ready?.response.id === responseId ? null : state.ready,
        optOut: state.optOut?.id === responseId ? null : state.optOut,
      });
    },
    clear: () => setState(EMPTY_STATE),
  };
}
