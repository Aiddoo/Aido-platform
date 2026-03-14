/**
 * 레이아웃 상수
 * Android Tabs는 탭 바가 absolute position으로 콘텐츠 위에 오버레이되므로,
 * ScrollView 하단에 탭 바 높이만큼의 여백이 필요하다.
 */
export const LAYOUT = {
  /** Android 탭 바 오버레이를 회피하기 위한 ScrollView 하단 safe 패딩 */
  tabBarOverlayPadding: 120,
} as const;
