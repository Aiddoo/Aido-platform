export interface EventChannel<T> {
  subscribe(listener: (event: T) => void): () => void;
  /** 등록된 리스너에게 차례로 알린다. 한 리스너의 실패가 다른 리스너 알림을 막지 않는다 */
  emit(event: T): void;
}

type EventListenerErrorHandler = (error: unknown, channelName: string) => void;

function ignoreListenerError() {}

let reportListenerError: EventListenerErrorHandler = ignoreListenerError;

/** core는 관측 구현을 모르므로 bootstrap이 한 번 연결한다. 이미 다른 핸들러로 바뀌었다면 해제가 건드리지 않는다 */
export function setEventListenerErrorHandler(handler: EventListenerErrorHandler): () => void {
  reportListenerError = handler;
  return () => {
    if (reportListenerError === handler) {
      reportListenerError = ignoreListenerError;
    }
  };
}

/** 발행 중 구독·해지가 있어도 그 발행의 대상이 바뀌지 않도록 리스너를 복사해서 부른다 */
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
