/** 화면이 분기에 쓰는 기기 사실. 플랫폼과 OS 버전은 어댑터가 뜻으로 바꿔 준다 */
export interface DeviceTraits {
  /** 키보드가 오르내리는 동안 시스템이 인셋 애니메이션을 주는 기기인지. 없으면 키보드를 손가락으로 따라 끌어 내릴 수 없다 */
  hasKeyboardInsetAnimation: boolean;
  /** 메모리가 적은 기기인지. 움직이는 장면의 입자 수와 색 깊이를 줄인다. 메모리를 알 수 없으면 아니다 */
  isLowMemoryDevice: boolean;
  /** 투명 헤더 아래로 지나가는 내용을 시스템 스크롤 엣지 효과가 흐려 주는 기기인지. 없으면 화면이 직접 페이드를 그린다 */
  hasSystemScrollEdgeEffect: boolean;
}
