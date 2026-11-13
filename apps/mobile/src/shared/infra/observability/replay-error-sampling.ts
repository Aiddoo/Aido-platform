import type { Event } from '@sentry/react-native';

/** 앱이 잡지 못한 오류(전역 핸들러의 `handled: false`)와 강제 종료(`fatal`)만 오류 녹화를 보낸다. 잡아서 보고한 오류는 화면이 살아 있어 녹화 없이도 고친다 */
export function shouldCaptureErrorReplay(event: Event): boolean {
  return (
    event.level === 'fatal' ||
    (event.exception?.values ?? []).some(({ mechanism }) => mechanism?.handled === false)
  );
}
