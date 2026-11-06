import { usePushNotificationGateway } from '@src/bootstrap/providers/di-context';
import type { PushNotificationResponse } from '@src/core/ports/push-notification-gateway';
import { useEffect, useLayoutEffect, useState } from 'react';

type LastResponse = PushNotificationResponse | null | undefined;

// 아직 모르면 undefined, 응답이 없으면 null. 같은 알림이면 이전 값을 유지하고, 응답에서 null로의 전환은 지워졌을 때만 일어난다
function getNextResponse(previous: LastResponse, next: PushNotificationResponse | null) {
  if (next == null) {
    return null;
  }
  if (previous == null) {
    return next;
  }
  return previous.id === next.id ? previous : next;
}

export function useColdStartNotificationResponse({
  processResponse,
}: {
  processResponse: (response: PushNotificationResponse) => void;
}) {
  const gateway = usePushNotificationGateway();
  const [response, setResponse] = useState<LastResponse>(undefined);

  useLayoutEffect(() => {
    setResponse((previous) => getNextResponse(previous, gateway.getLastResponse()));
    const unsubscribeResponse = gateway.addResponseListener((received) =>
      setResponse((previous) => getNextResponse(previous, received)),
    );
    const unsubscribeCleared = gateway.addResponseClearedListener(() => setResponse(null));

    return () => {
      unsubscribeResponse();
      unsubscribeCleared();
    };
  }, [gateway]);

  useEffect(() => {
    if (response == null) {
      return;
    }

    processResponse(response);
  }, [processResponse, response]);
}
