# widget — iOS·Android 홈 화면 위젯

iOS는 Expo SDK 58의 `expo-widgets`, Android는 `react-native-android-widget`으로 구현한다.
[플랫폼 설정·제약·native QA](../../../.claude/widgets.md)를 따른다.

Android를 `expo-widgets`로 옮기지 않는다. SDK 58의 Android 구현에는 timeline이 없고, AppWidget
provider class가 바뀌면 사용자가 홈 화면에 둔 위젯이 사라지기 때문이다.

## 구조

| 위치                           | 책임                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| domains                        | snapshot v2 Zod 계약(v1 읽기 포함), day 선택 policy, 직렬화 props |
| apis                           | summary→snapshot→props·iOS timeline mapper와 쓰기 직렬화          |
| bridge                         | iOS timeline / Android snapshot·HeadlessJS / 미지원 플랫폼 경계   |
| components/widgets.ios.tsx     | 격리된 SwiftUI renderer (`expo-widgets`)                          |
| components/widgets.android.tsx | 격리된 FlexWidget·TextWidget·SvgWidget renderer                   |
| hooks                          | AuthProvider가 소유하는 계정·날짜(오늘·내일)·언어 동기화          |

위젯은 네트워크·인증 저장소에 접근하지 않는다. 변경은 앱에서 검증한 표시용 snapshot으로만
전달한다. snapshot은 오늘과 (받을 수 있으면) 내일 요약을 담는다. iOS는 [지금: 오늘] →
[다음 자정: 내일] → [그다음 자정: stale] timeline, Android는 renderer가 기기 시간대의 오늘 key와
같은 day를 고르고 OS 주기 갱신을 사용한다. 동기화 실패는 앱으로 throw하지 않는다.

iOS identity·App Group, Android provider 이름·widget ID·배치와 `aido_widget_snapshot_v1` 저장
key는 유지한다. 이미 저장된 v1 snapshot은 하루짜리 v2로 읽는다.
