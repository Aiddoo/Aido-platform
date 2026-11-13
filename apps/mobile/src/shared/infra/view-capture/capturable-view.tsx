import type { ViewCaptureHandle } from '@src/core/ports/view-capture-gateway';
import { type PropsWithChildren, type Ref, useImperativeHandle, useRef } from 'react';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

/** 라이브러리 자체가 컴포넌트라 DI로 바꿀 수 없어 경계 컴포넌트 파일 하나에서만 import한다 */
export function CapturableView({
  ref,
  children,
}: PropsWithChildren<{ ref: Ref<ViewCaptureHandle> }>) {
  const viewShotRef = useRef<ViewShotRef>(null);

  useImperativeHandle(
    ref,
    () => ({ capture: async () => (await viewShotRef.current?.capture?.()) ?? null }),
    [],
  );

  return (
    <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
      {children}
    </ViewShot>
  );
}
