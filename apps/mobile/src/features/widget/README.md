# widget — iOS·Android 홈 화면 위젯

Expo SDK 58의 `expo-widgets`로 양 플랫폼을 구현한다.
[플랫폼 설정·제약·native QA](../../../.claude/widgets.md)를 따른다.

## 구조

| 위치                           | 책임                                                 |
| ------------------------------ | ---------------------------------------------------- |
| domains                        | snapshot Zod 계약, 순수 policy, 직렬화 props         |
| apis                           | summary→snapshot→props mapper와 쓰기 직렬화          |
| bridge                         | iOS timeline / Android snapshot / 미지원 플랫폼 경계 |
| components/widgets.ios.tsx     | 격리된 SwiftUI renderer                              |
| components/widgets.android.tsx | 격리된 Glance renderer                               |
| hooks                          | AuthProvider가 소유하는 계정·날짜·언어 동기화        |

위젯은 네트워크·인증 저장소에 접근하지 않는다. 변경은 앱에서 검증한 표시용 snapshot으로만
전달한다. iOS는 다음 자정 stale 엔트리, Android는 renderer 날짜 경계와 OS 주기 갱신을 사용한다.
동기화 실패는 앱으로 throw하지 않는다.

iOS identity·App Group·snapshot v1은 유지한다. Android의 이전 component 이름은 SDK receiver로
연결하고, 이전 snapshot은 read-only native adapter로 이관한다. 기존 widget ID와 배치를 유지한다.
SDK의 cold launch 누락은 버전 고정된 최소 Glance patch로 보완한다.
