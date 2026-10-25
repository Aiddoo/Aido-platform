# 1.13.0 Native QA (친구 초대)

## 준비

- 개발 빌드(`aido-dev` 스킴)가 설치된 iOS 시뮬레이터 또는 Android 에뮬레이터 1대.
  Android는 `pnpm --filter mobile adb:reverse`와 `adb reverse tcp:8081 tcp:8081`이 필요하다.
- Docker 개발 API에 `INVITE_ENABLED=true`로 켠다(`apps/api/.env`). 꺼져 있으면 초대 화면이 숨겨진다.
- 테스트 계정은 값 없이 env 이름으로만 다룬다. `cp .env.maestro.example .env.maestro` 후 채운다(커밋 금지).
  - 초대자 `QA_INVITER_*`: 코드를 읽고 초대한 친구 목록을 보는 계정
  - 초대받는 `QA_INVITEE_*`: 친구 0명. 실행마다 새 계정
  - `full`만: 기존 사용자 `QA_EXISTING_*`

## 실행

```sh
pnpm --filter mobile maestro:release-1.13.0:smoke   # 링크 콜드 스타트 + 코드 입력 + 내 초대
pnpm --filter mobile maestro:release-1.13.0         # full (진입점·프리미엄 보상·기존 사용자·smoke 포함)
```

초대 코드를 미리 알면 `QA_INVITE_CODE`(또는 `INVITE_CODE`)로 넘기면 초대자 로그인 단계를 건너뛴다.
비워 두면 `subflows/resolve-invite-code.yaml`이 초대자로 로그인해 `/friends/invite`에서 코드를
`copyTextFrom`으로 읽고 로그아웃한다. 언어 확인은 기기 언어를 한국어/영어로 바꿔 두 번 실행한다
(문구는 정규식 `한글|English` 대안으로 둘 다 맞춘다).

## 흐름

| 파일                                | 태그        | 확인하는 것                                                            |
| ----------------------------------- | ----------- | ---------------------------------------------------------------------- |
| `invite-cold-start-logged-out.yaml` | smoke, full | 로그아웃 콜드 스타트 → 초대 카드 → 로그인 → 보류 초대 적용 → 환영 시트 |
| `invite-code-entry.yaml`            | smoke, full | `/invite` 형식 오류가 같은 화면에 남음, 붙여넣기 칩, 유효 코드 제출    |
| `my-invite.yaml`                    | smoke, full | 공유 동작 3종, 링크 복사 토스트, 발자국 판, 전체 보기와 전체/대기 탭   |
| `entry-points.yaml`                 | full        | 친구 빈 상태 CTA, 마이페이지 카드, 기능 안내 카드                      |
| `premium-grant-subscription.yaml`   | full        | 초대 보상 premium 계정의 구독 화면 이용 기간                           |
| `invite-existing-user.yaml`         | full        | 로그인된 기존 사용자는 가입 CTA·보상 없이 친구 맺기만                  |
| `avatar-and-date-smoke.yaml`        | full        | 화면 이동 후 아바타 재마운트, 날짜 이동 후 오늘 복귀                   |
| `invite-cold-start-https.yaml`      | 운영 빌드   | `https://aido.kr/i/<CODE>` 열기                                        |
| `login.yaml`, `subflows/*`          | 보조        | 이메일 로그인, 데이터 초기화 후 로그인, 코드 읽기                      |

`run.sh`가 순서를 고정한다(초대받는 계정이 친구 0명일 때 entry-points → cold-start → 보상 확인).

## 플랫폼 메모

- https 링크는 AASA/assetlinks에 운영 앱만 등록돼 dev/preview에서는 열리지 않는다. 개발 빌드는
  `aido-dev://invite/<CODE>`로 같은 카드를 검증한다. iOS 시뮬레이터에서 Maestro `openLink`가 universal
  link를 앱으로 넘기지 못하면 `xcrun simctl openurl booted https://aido.kr/i/<CODE>`로 직접 연다.
- iOS에서 Maestro `back`은 동작하지 않아 닫기는 상단 영역 탭을 쓴다(1.12.1과 동일).

## 상태 초기화

각 흐름은 `launchApp: clearState`로 시작한다. iOS에서 Keychain 토큰이 남아 로그인 상태가 유지되면 앱을
삭제 후 재설치하고, 초대받는/기존 계정은 새로 만든다(초대는 한 번 적용되면 재사용할 수 없다).

## 알려진 한계

- 카카오톡 공유와 시스템 공유 시트는 외부 앱이라 자동화하지 않는다. 버튼 노출만 확인하고,
  실제 공유 메시지·카카오 카드 열기는 **수동 확인 항목**이다.
- 붙여넣기 칩은 클립보드에 글자가 있을 때만 나타나 조건부로 확인한다.
- 로그아웃 확인 대화상자의 버튼 선택은 텍스트 index에 의존한다(testID 제안은 PR 설명 참고).

## 친구 줄 (`friend-strip.yaml`)

초대 흐름과 따로, Docker 개발 API(`EXPO_PUBLIC_API_URL=http://localhost:8080`)에 연결한 개발 빌드에서
로그인된 상태로 실행한다. 계정 비밀번호·token은 repository에 저장하지 않는다.

| 변수                       | 의미                                               |
| -------------------------- | -------------------------------------------------- |
| `QA_DATE`                  | 확인할 날짜(`YYYY-MM-DD`)                          |
| `QA_TODO_TITLE`            | 그 날짜의 내 할 일 제목                            |
| `QA_FRIEND_NAME`           | 친구 줄 첫 화면에 보이는 친구 표시 이름            |
| `QA_FRIEND_TODO_TITLE`     | 그 친구의 같은 날짜 할 일 제목                     |
| `QA_FAR_FRIEND_ID`         | 친구 목록 첫 페이지(20명) 밖에 있는 친구의 user id |
| `QA_FAR_FRIEND_NAME`       | 그 친구의 표시 이름                                |
| `QA_FAR_FRIEND_TODO_TITLE` | 그 친구의 같은 날짜 할 일 제목                     |

```sh
maestro --device <device> test -e QA_DATE=… -e QA_TODO_TITLE=… … apps/mobile/maestro/release-1.13.0/friend-strip.yaml
```

친구 줄에서 친구 → 같은 날짜의 친구 할 일, "나" → 내 할 일 복귀, 첫 페이지 밖 친구 딥링크 표시를 확인한다.
