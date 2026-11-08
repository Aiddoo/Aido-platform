# widget — iOS·Android 홈 화면 위젯

iOS는 Expo SDK 58의 `expo-widgets`, Android는 `react-native-android-widget`으로 구현한다.
[플랫폼 설정·제약·native QA](../../../../.claude/widgets.md)를 따른다.

Android를 `expo-widgets`로 옮기지 않는다. 주기 갱신이 없고, 탭으로 앱을 여는 경로를 찾지 못했고, provider
class 이름이 바뀌면 홈 화면의 위젯이 사라지고, 쓸 수 있는 부품이 제한적이기 때문이다. 자세한 근거는
[widgets.md](../../../../.claude/widgets.md)에 있다.

## 구조

| 위치                           | 책임                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| schemas                        | snapshot v2 Zod 계약(v1 읽기 포함), props, 탐색 명령                |
| domains                        | day 선택 policy, 탐색 명령 유효성                                   |
| utils                          | 첫 동기화 전 props, 탐색 링크 변환(번들이 별칭을 못 풀어 상대 경로) |
| constants                      | Android 위젯 정의·저장 키·탐색 action                               |
| apis                           | summary→snapshot→props·iOS timeline mapper와 쓰기 직렬화            |
| bridge                         | iOS timeline / Android snapshot·HeadlessJS / 미지원 플랫폼 경계     |
| components/widgets.ios.tsx     | 격리된 SwiftUI renderer (`expo-widgets`)                            |
| components/widgets.android.tsx | 격리된 FlexWidget·TextWidget·SvgWidget renderer                     |
| hooks                          | AuthBootProvider가 소유하는 계정·날짜(오늘·내일)·언어 동기화        |

위젯은 네트워크·인증 저장소에 접근하지 않는다. 변경은 앱에서 검증한 표시용 snapshot으로만
전달한다. snapshot은 오늘과 (받을 수 있으면) 내일 요약을 담는다. iOS는 [지금: 오늘] →
[다음 자정: 내일] → [그다음 자정: stale] timeline, Android는 renderer가 기기 시간대의 오늘 key와
같은 day를 고르고 OS 주기 갱신을 사용한다. 동기화 실패는 앱으로 throw하지 않는다.

iOS identity·App Group, Android provider 이름·widget ID·배치와 `aido_widget_snapshot_v1` 저장
key는 유지한다. 이미 저장된 v1 snapshot은 하루짜리 v2로 읽는다.
