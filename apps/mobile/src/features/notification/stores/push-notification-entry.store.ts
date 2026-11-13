import {
  type HandledResponseIds,
  hasHandledResponse,
  type PushNotificationResponse,
  PushNotificationResponsePolicy,
  rememberHandledResponse,
} from '../domains/push-notification-response.model';
import type { NotificationDestination } from '../utils/notification-destination.view-model';

interface PushNotificationEntryState {
  /** 아직 열지 못한 탭 하나. 마지막 탭이 이긴다 */
  pending: PushNotificationResponse | null;
  /** 소유 확인이 끝나 열 곳이 정해진 탭 */
  ready: ReadyPushNotificationEntry | null;
  /** 아직 보내지 못한 수신 거부. 다음 탭에 밀려 사라지면 안 되어 따로 둔다 */
  optOut: PushNotificationResponse | null;
  /** 첫 세그먼트가 아직 앱 화면이 아니다(Index·loading·로그인). 세션이 끝나도 경로 사실이라 남긴다 */
  isAtAppEntry: boolean;
}

export interface ReadyPushNotificationEntry {
  response: PushNotificationResponse;
  destination: NotificationDestination;
}

export interface PushNotificationEntryStore {
  getSnapshot(): PushNotificationEntryState;
  subscribe(listener: () => void): () => void;
  receive(response: PushNotificationResponse): void;
  /** 소유 확인이 끝난 탭의 목적지를 정한다. 그 사이 새 탭이 왔으면 무시한다 */
  markReady(responseId: string, destination: NotificationDestination): void;
  /** 끝난 응답을 슬롯에서 빼고, 같은 응답이 다시 와도 무시한다(최근 응답만 기억한다) */
  settle(responseId: string): void;
  /** 경로를 읽는 `useAppEntrySegmentSync`만 부른다 */
  markAppEntry(isAtAppEntry: boolean): void;
  clear(): void;
}

const INITIAL_STATE: PushNotificationEntryState = {
  pending: null,
  ready: null,
  optOut: null,
  isAtAppEntry: true,
};

/** 응답 슬롯. 라우트 경계가 다시 그려도 남도록 DI가 소유한다 */
export function createPushNotificationEntryStore(): PushNotificationEntryStore {
  let state = INITIAL_STATE;
  let handledResponseIds: HandledResponseIds = [];
  const listeners = new Set<() => void>();

  function setState(next: PushNotificationEntryState) {
    state = next;
    for (const listener of Array.from(listeners)) {
      listener();
    }
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    receive: (response) => {
      if (
        hasHandledResponse(handledResponseIds, response.id) ||
        response.id === state.pending?.id ||
        response.id === state.ready?.response.id ||
        response.id === state.optOut?.id
      ) {
        return;
      }
      setState(
        PushNotificationResponsePolicy.isMarketingOptOut(response)
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
      handledResponseIds = rememberHandledResponse(handledResponseIds, responseId);
      setState({
        ...state,
        pending: state.pending?.id === responseId ? null : state.pending,
        ready: state.ready?.response.id === responseId ? null : state.ready,
        optOut: state.optOut?.id === responseId ? null : state.optOut,
      });
    },
    markAppEntry: (isAtAppEntry) => {
      if (isAtAppEntry === state.isAtAppEntry) {
        return;
      }
      setState({ ...state, isAtAppEntry });
    },
    clear: () =>
      setState({ pending: null, ready: null, optOut: null, isAtAppEntry: state.isAtAppEntry }),
  };
}
