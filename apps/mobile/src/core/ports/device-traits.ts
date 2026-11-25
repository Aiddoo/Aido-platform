/** 화면이 분기에 쓰는 기기 사실. 플랫폼과 OS 버전은 어댑터가 뜻으로 바꿔 준다 */
export interface DeviceTraits {
  /** 키보드가 오르내리는 동안 시스템이 인셋 애니메이션을 주는 기기인지. 없으면 키보드를 손가락으로 따라 끌어 내릴 수 없다 */
  hasKeyboardInsetAnimation: boolean;
}
