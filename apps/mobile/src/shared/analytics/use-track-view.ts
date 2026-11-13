import type { AnalyticsEventParams } from '@src/core/ports/analytics';
import { useAnalytics } from '@src/shared/di/shared-di-context';
import { useEffect, useEffectEvent, useRef } from 'react';

import type { AppEventMap } from './event-map';

type ViewEventName = {
  [E in keyof AppEventMap & string]: AppEventMap[E] extends undefined ? never : E;
}[keyof AppEventMap & string];

interface TrackedView<E extends ViewEventName> {
  /** 같은 보기인지 가르는 값. 마운트 안에서 key마다 한 번 보낸다 */
  key: string;
  params: AppEventMap[E] & AnalyticsEventParams;
}

/**
 * 경로가 바뀌지 않는 보기(시트·카드·단계·받은 내용)를 마운트 안에서 key마다 한 번 센다. null은 아직 보이지 않은 것이다.
 * 다시 그리기·포커스 복귀·숨었다 다시 보이기로는 다시 보내지 않고, 화면이 다시 마운트되면 새 보기로 센다
 */
export function useTrackView<E extends ViewEventName>(
  eventName: E,
  view: TrackedView<E> | null,
): void {
  const analytics = useAnalytics();
  const trackedKeysRef = useRef(new Set<string>());
  const key = view?.key ?? null;
  // params 객체를 렌더마다 새로 만들어도 다시 보내지 않게 효과는 key만 본다
  const emit = useEffectEvent(() => {
    if (view != null) {
      analytics.trackEvent(eventName, view.params);
    }
  });

  useEffect(() => {
    if (key == null || trackedKeysRef.current.has(key)) {
      return;
    }
    trackedKeysRef.current.add(key);
    emit();
  }, [key]);
}
