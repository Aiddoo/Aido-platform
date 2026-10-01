# widget — iOS·Android 홈 화면 위젯

Expo SDK 58의 `expo-widgets`로 양 플랫폼을 구현한다.
[플랫폼 설정·제약·native QA](../../../.claude/widgets.md)를 따른다.

## 구조

| 위치                              | 책임                                                 |
| --------------------------------- | ---------------------------------------------------- |
| models                            | snapshot Zod 계약, 순수 policy, 직렬화 props         |
| services                          | summary→snapshot→props mapper와 쓰기 직렬화          |
| bridge                            | iOS timeline / Android snapshot / 미지원 플랫폼 경계 |
| presentations/widgets.ios.tsx     | 격리된 SwiftUI renderer                              |
| presentations/widgets.android.tsx | 격리된 Glance renderer                               |
| presentations/hooks               | AuthProvider가 소유하는 계정·날짜·언어 동기화        |

위젯은 네트워크·인증 저장소에 접근하지 않는다. 변경은 앱에서 검증한 표시용 snapshot으로만
전달한다. iOS는 다음 자정 stale 엔트리, Android는 renderer 날짜 경계와 OS 주기 갱신을 사용한다.
동기화 실패는 앱으로 throw하지 않는다.

iOS identity·App Group·snapshot v1은 유지한다. Android의 이전 component 이름은 SDK receiver로
연결하고, 이전 snapshot은 read-only native adapter로 이관한다. 기존 widget ID와 배치를 유지한다.
SDK의 cold launch 누락은 버전 고정된 최소 Glance patch로 보완한다.

## 1.10.0 migration evidence

| Measure                          | 1.9.0                                                  | 1.10.0                                                                 |
| -------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Non-test TypeScript source files | 22                                                     | 14                                                                     |
| Non-test TypeScript source lines | 1,685                                                  | 1,026                                                                  |
| Android widget implementation    | Separate headless renderer, MMKV snapshot, WorkManager | Expo Widgets registry, shared snapshot props, platform renderer        |
| Android layouts                  | Legacy provider placements                             | Existing component/ID preserved; summary 2×2, list 4×2, large list 4×4 |
| iOS widget identity              | `AidoTodayList`, existing App Group                    | Preserved                                                              |
| Tap while app is closed          | JavaScript headless interaction                        | Native Glance activity launch                                          |
| Logout synchronization           | Independent writes                                     | Serialized writes; obsolete queued snapshots skipped                   |

Counts compare the tracked 1.9.0 revision with the migration worktree and exclude tests, documentation, native plugins, and vendor patches. They measure source size, not frame performance. Android compatibility adds 274 production lines across one plugin and two Kotlin adapters. An actual 1.8.0 → 1.10.0 APK upgrade preserved three registered widgets, matched the shared mapper output, left the old MMKV files unchanged, and passed 50 concurrent migration/account-write races. See the platform guide for the reproducible native harness and remaining OEM/release checks.
