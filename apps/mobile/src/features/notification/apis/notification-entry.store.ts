import { MARKETING_OPT_OUT_ACTION } from '../constants/notification.constants';
import {
  NotificationPolicy,
  type PendingNotificationResponse,
} from '../domains/notification.model';
import type { NotificationDestination } from '../utils/notification-destination';

interface NotificationEntryState {
  /** 아직 열지 못한 탭 하나. 마지막 탭이 이긴다 */
  pending: PendingNotificationResponse | null;
  /** 소유 확인이 끝나 열 곳이 정해진 탭 */
  ready: ReadyNotificationEntry | null;
  /** 아직 보내지 못한 수신 거부. 다음 탭에 밀려 사라지면 안 되어 따로 둔다 */
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
  /** 소유 확인이 끝난 탭의 목적지를 정한다. 그 사이 새 탭이 왔으면 무시한다 */
  markReady(responseId: string, destination: NotificationDestination): void;
  /** 끝난 응답을 슬롯에서 빼고, 같은 응답이 다시 와도 무시한다(최근 응답만 기억한다) */
  settle(responseId: string): void;
  clear(): void;
}

const EMPTY_STATE: NotificationEntryState = { pending: null, ready: null, optOut: null };

/** 응답 슬롯. 라우트 경계가 다시 그려도 남도록 DI가 소유한다 */
export function createNotificationEntryStore(): NotificationEntryStore {
  let state = EMPTY_STATE;
  let handledResponseIds: readonly string[] = [];
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
        NotificationPolicy.hasHandledResponse(response, handledResponseIds) ||
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
      handledResponseIds = NotificationPolicy.rememberHandledResponse(
        { id: responseId },
        handledResponseIds,
      );
      setState({
        pending: state.pending?.id === responseId ? null : state.pending,
        ready: state.ready?.response.id === responseId ? null : state.ready,
        optOut: state.optOut?.id === responseId ? null : state.optOut,
      });
    },
    clear: () => setState(EMPTY_STATE),
  };
}
