import { useAnalytics } from '@src/shared/di/shared-di-context';
import { useEffect, useEffectEvent, useRef } from 'react';

import type { AppEventMap } from './event-map';
import type { AppEventName } from './track';

type ViewEventName = {
  [E in AppEventName]: AppEventMap[E] extends undefined ? never : E;
}[AppEventName];

interface TrackedView<E extends ViewEventName> {
  /** 같은 보기인지 가르는 값. 마운트 안에서 key마다 한 번 보낸다 */
  key: string;
  params: AppEventMap[E];
}

/** null은 아직 보이지 않은 것이다. 다시 그리기·포커스 복귀로는 다시 보내지 않고 다시 마운트되면 새 보기로 센다 */
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
