export interface EventChannel<T> {
  /** 리스너를 등록한다. 반환 함수로 구독을 끝낸다 */
  subscribe(listener: (event: T) => void): () => void;
  /** 등록된 리스너에게 차례로 알린다. 한 리스너의 실패가 다른 리스너 알림을 막지 않는다 */
  emit(event: T): void;
}

type EventListenerErrorHandler = (error: unknown, channelName: string) => void;

function ignoreListenerError() {}

let reportListenerError: EventListenerErrorHandler = ignoreListenerError;

/**
 * 리스너가 던진 오류를 받을 곳을 정한다. core는 관측 구현을 모르므로 bootstrap이 한 번 연결한다.
 * 반환 함수로 연결을 푼다(이미 다른 핸들러로 바뀌었다면 건드리지 않는다).
 */
export function setEventListenerErrorHandler(handler: EventListenerErrorHandler): () => void {
  reportListenerError = handler;
  return () => {
    if (reportListenerError === handler) {
      reportListenerError = ignoreListenerError;
    }
  };
}

/**
 * React/DI를 모르는 층이 위층에 알리는 단방향 채널.
 * 발행 중 구독·해지가 있어도 그 발행의 대상은 바뀌지 않도록 리스너를 복사해서 부른다.
 * 리스너의 오류는 다른 리스너에게 번지지 않고 `setEventListenerErrorHandler`로 보고한다.
 */
export function createEventChannel<T = void>(name: string): EventChannel<T> {
  const listeners = new Set<(event: T) => void>();

  function subscribe(listener: (event: T) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function emit(event: T): void {
    for (const listener of Array.from(listeners)) {
      try {
        listener(event);
      } catch (error) {
        reportListenerError(error, name);
      }
    }
  }

  return { subscribe, emit };
}
