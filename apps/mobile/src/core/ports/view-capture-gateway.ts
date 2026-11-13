/** 화면 조각을 이미지로 찍을 수 있는 영역. 영역은 어댑터가 준 `CapturableView`가 만든다 */
export interface ViewCaptureHandle {
  /** 찍은 PNG 파일 uri. 영역이 아직 없으면 null */
  capture(): Promise<string | null>;
}

export interface ViewCaptureGateway {
  /** 영역을 PNG 파일로 찍는다. 찍을 수 없으면 null */
  capture(handle: ViewCaptureHandle | null): Promise<string | null>;
}
