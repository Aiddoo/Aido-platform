import type { ViewCaptureHandle } from '@src/core/ports/view-capture-gateway';
import { type PropsWithChildren, type Ref, useImperativeHandle, useRef } from 'react';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

/**
 * 안의 화면을 PNG로 찍을 수 있게 감싼다. 라이브러리 자체가 컴포넌트라 DI 값으로 바꿀 수 없어
 * 경계 컴포넌트 파일 하나에서만 import한다. 찍기는 `ViewCaptureGateway.capture(ref)`로 한다.
 */
export function CapturableView({
  ref,
  children,
}: PropsWithChildren<{ ref: Ref<ViewCaptureHandle> }>) {
  const viewShotRef = useRef<ViewShotRef>(null);

  useImperativeHandle(ref, () => ({ capture: async () => viewShotRef.current?.capture?.() }), []);

  return (
    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
      {children}
    </ViewShot>
  );
}
