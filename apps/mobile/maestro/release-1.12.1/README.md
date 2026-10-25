# 1.12.1 Native QA

Docker 개발 API(`EXPO_PUBLIC_API_URL=http://localhost:8080`)에 연결한 개발 빌드에서 로그인된 상태로 실행한다.
Android 에뮬레이터는 `adb reverse tcp:8080 tcp:8080`과 `adb reverse tcp:8081 tcp:8081`이 필요하다.
계정 비밀번호·token은 repository에 저장하지 않는다.

## 입력

| 변수             | 의미                                       |
| ---------------- | ------------------------------------------ |
| `QA_TODO_ID`     | 오늘 날짜의 내 할 일 id                    |
| `QA_TODO_TITLE`  | 그 할 일 제목                              |
| `QA_FRIEND_NAME` | 피드 아바타 줄에 보이는 친구 표시 이름     |
| `QA_FRIEND_ID`   | 그 친구의 user id(친구 피드 딥링크 확인용) |

```sh
maestro --device <device> test \
  -e QA_TODO_ID=… -e QA_TODO_TITLE=… -e QA_FRIEND_NAME=… -e QA_FRIEND_ID=… \
  apps/mobile/maestro/release-1.12.1
```

## 흐름

| 파일                          | 확인하는 것                                                                |
| ----------------------------- | -------------------------------------------------------------------------- |
| `todo-detail-and-sheets.yaml` | 할 일 상세 링크, 피드 더보기 → 옵션 시트 → 날짜 시트로 이어 열기와 닫기    |
| `widget-and-push-links.yaml`  | 1.11.x 위젯이 저장한 `feed?action=add-todo`, `todo/{id}` URI와 알림함 링크 |
| `friend-feed.yaml`            | 친구 아바타로 같은 피드 화면에서 친구 피드 전환, `feed?friendId=` 딥링크   |
| `memo-tab.yaml`               | 메모 탭과 작성 화면                                                        |

행을 누르면 완료가 바뀌므로 할 일 상세는 링크로 연다. iOS는 할 일 행을 하나의 접근성 요소로 읽고
더보기를 VoiceOver 동작으로 제공하므로, Maestro는 iOS에서 같은 옵션 시트를 링크로 연다.
iOS에서 Maestro `back`은 동작하지 않아 시트는 딤 영역을 눌러 닫는다.

## 결과 (2026-10-25)

| 기기                                  | 결과                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| iPhone Duo 시뮬레이터(접힘, iOS 27.1) | 3/4 통과. `todo-detail-and-sheets`는 아래 알려진 문제로 실패           |
| Android Medium Phone(API 36.1)        | 4/4 통과                                                               |
| Android 폴더블 AVD                    | 미실행. AVD가 `qemu mprotect failed`로 부팅하지 못함(wipe 후에도 동일) |

### 알려진 문제: iOS에서 두 번째로 연 시트 route의 접근성 트리

시트 route를 한 번 닫은 뒤 다시 연 시트(옵션 → 날짜 변경처럼 이어 열기 포함)는 화면에 정상으로 보이고 터치도
동작하지만, XCTest 접근성 트리에서 시트 화면의 자식이 비어 있다. 처음 여는 시트와, 닫은 뒤의 피드는 정상이다.

배제한 원인: `transparentModal` → `containedTransparentModal`, 시트 route 안의 `GestureHandlerRootView`,
크기 확정 대기, route 애니메이션(`none`/`fade`), `replace` → `back`+`push`(지연 포함). 어느 쪽으로 바꿔도 같아
우리 코드가 아닌 RN Fabric·react-native-screens의 iOS 네이티브 계층이나 XCTest 스냅샷 쪽으로 본다.

판단: 화면·터치는 정상이고 VoiceOver 영향은 실기기로만 확정할 수 있어 1.12.1을 막지 않는다. 추적 이슈로 분리하고,
**스토어 제출 전 실기기 VoiceOver로 옵션 → 날짜 변경 시트를 읽는지 확인**한다. 재현되면 제출을 멈추고 고친다.
