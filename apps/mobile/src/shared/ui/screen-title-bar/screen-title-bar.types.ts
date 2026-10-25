export interface ScreenTitleBarProps {
  /** 가운데 굵게 놓이는 화면 이름 */
  title: string;
  /** 제목 아래 한 줄 보조 문구 (조회수 등) */
  subtitle?: string;
  /** 뒤로가기를 눌렀을 때 */
  onBackPress: () => void;
  /** 뒤로가기가 현재 화면 안의 상태만 닫을 때 설명하는 접근성 이름 */
  backAccessibilityLabel?: string;
  /** 저장 중처럼 현재 화면을 벗어나면 안 될 때 뒤로가기를 잠근다. */
  isBackDisabled?: boolean;
}
