/** 시스템이 요청을 무시할 수 있다(분할 화면, Android 16+ 큰 화면). 실패해도 화면은 그대로 쓸 수 있어 구현은 오류를 삼킨다 */
export interface ScreenOrientationGateway {
  lockPortrait(): void;
  unlock(): void;
}
