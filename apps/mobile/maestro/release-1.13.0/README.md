# 1.13.0 Native QA (친구 초대)

로컬 Docker 개발 API에 연결한 개발 빌드(`aido-dev`)에서 실행한다. 운영·공유 서버에는 쓰지 않는다.
임시 계정 스크립트와 flow의 API 호출 모두 localhost 계열이 아니면 시작 전에 멈춘다.

## 준비

- 개발 빌드가 설치된 iOS 시뮬레이터 또는 Android 에뮬레이터 1대. Android는 `pnpm --filter mobile adb:reverse`와
  `adb reverse tcp:8081 tcp:8081`이 필요하다.
- 로컬 API를 `INVITE_ENABLED=true`로 켠다(`apps/api/.env`). `flag-off` 흐름만 `false`로 다시 시작한다.
- 앱에 아래 testID가 있어야 한다(없으면 해당 단계가 실패한다).

## 계정(두 개, 직접 만든다)

```sh
pnpm --filter mobile maestro:accounts create          # A(초대자), B(초대받는 사람) 생성 -> .env.maestro
pnpm --filter mobile maestro:accounts reset           # B의 수락·친구·보상·프리미엄·RewardClaim 초기화
pnpm --filter mobile maestro:accounts fill-friends a  # A(또는 b)의 친구를 한도(5)까지 더미로 채움
pnpm --filter mobile maestro:accounts clear-friends   # 더미 친구 삭제
pnpm --filter mobile maestro:accounts delete          # A, B, 더미 삭제 + .env.maestro 키 비움
```

- 이메일은 `maestro-a+<ts>@example.test`, 비밀번호는 무작위이며 gitignore된 `.env.maestro`에만 쓰고 출력하지 않는다.
- 가입은 실제 API로 하고, 메일 인증 코드만 로컬 DB에서 완료로 표시한다. 초대 수락 기록·`RewardClaim`·
  친구 한도 채우기는 공개 API에 없어 로컬 DB를 직접 건드린다. 이 스크립트만 DB를 만진다.
- 대상 확인: `API_BASE_URL`, `DATABASE_URL`의 host가 `localhost`, `127.0.0.1`, `::1`, `db`, `api`,
  `host.docker.internal`이 아니면 쓰기 전에 종료한다. `NODE_ENV=production`과 이름에 `prod`가 든 DB도 거부한다.
  시작할 때 `api=<host:port> db=<host:port/db>`만 출력한다(자격 증명은 출력하지 않는다).
- `reset`은 로컬 DB의 `RewardClaim` 전체를 지운다(기기·신원 해시에 사용자 연결이 없어서다). 로컬 전용이다.

## 실행

```sh
pnpm --filter mobile maestro:release-1.13.0:smoke    # 링크 콜드 스타트 + 코드 입력 + 내 초대
pnpm --filter mobile maestro:release-1.13.0          # full: smoke + 진입점·보상·실패 케이스
pnpm --filter mobile maestro:release-1.13.0:failure  # 실패 케이스만
pnpm --filter mobile maestro:release-1.13.0:flag-off # 아래 '기능 플래그 끄기' 후
```

직접 실행하려면 이 폴더에서 `maestro test --include-tags smoke --exclude-tags fresh,production-build,flag-off .`.
`run.sh`는 `.env.maestro`를 읽고, 초대 수락을 되돌릴 수 없어서 `fresh` 태그 flow마다 `reset`을 먼저 하고 하나씩 돌린다.
기기는 `QA_DEVICE`, iOS면 `QA_PLATFORM=ios`(android-only 제외), 스킴은 `QA_SCHEME`로 바꾼다.

## 설계

- `config.yaml`: flow 글롭, `executionOrder`(`continueOnFailure: true`), 태그 설명.
- 각 flow는 독립적이다. `onFlowStart`에서 `scripts/lib.js` -> `scripts/setup.js`(HTTP로 A, B 로그인·현재 코드 조회)
  -> `subflows/fresh-start.yaml`(`clearState`, iOS는 `clearKeychain`)을 실행하고 필요하면 `redeem.js`,
  `rotate-code.js`로 상태를 API로 준비한다. 결과는 `output.a`, `output.b`, `output.code`에 있다.
- 비밀번호는 shell의 `MAESTRO_QA_*` 변수로만 전달한다(argv에 남지 않음). 일반 값은 `-e`.
- 선택자는 testID(`id:`)로 탭·입력하고, 한/영 문구 정규식은 화면 문구 검증에만 쓴다.

## 흐름과 기대 결과

| 태그                  | 파일                             | 시나리오                                | 기대 화면/문구                                            | 오류 코드               |
| --------------------- | -------------------------------- | --------------------------------------- | --------------------------------------------------------- | ----------------------- |
| smoke, full           | `invite-cold-start-logged-out`   | 로그아웃 링크 -> 카드 -> 로그인 -> 적용 | 초대 카드 -> `OO님과 친구가 됐어요` + `프리미엄 N일`      | -                       |
| smoke, full           | `invite-code-entry`              | 유효한 코드 직접 입력                   | 초대 카드                                                 | -                       |
| smoke, full           | `my-invite`                      | 공유 3종, 복사 토스트, 판, 전체 보기    | `링크를 복사했어요`, 전체/대기 탭, 초대한 B 표시          | -                       |
| full                  | `entry-points`                   | 친구 빈 상태, 마이페이지, 기능 안내     | 모두 `내 초대 코드` 화면                                  | -                       |
| full                  | `premium-grant-subscription`     | 보상 premium 구독 화면                  | `초대 보상으로 프리미엄 이용 중` + `이용 기간`            | -                       |
| full                  | `avatar-and-date-smoke`          | 화면 왕복 후 아바타, 날짜 복귀          | `나 프로필`                                               | -                       |
| failure               | `failure-code-format`            | 형식 오류, 고쳐서 재제출                | 같은 화면 오류 + `다시 확인`, 포커스 유지, 재제출 성공    | (클라이언트)            |
| failure               | `failure-code-not-found`         | 없는 코드                               | `초대 코드를 찾을 수 없어요`, `코드 직접 입력하기`        | INVITE_2101             |
| failure               | `failure-link-rotated`           | 링크 재발급 후 이전 링크                | `초대 링크가 바뀌었어요`, 새 링크는 정상                  | INVITE_2102             |
| failure               | `failure-self-invite`            | 내 링크                                 | `내 초대 링크예요`, 수락 버튼 없음                        | INVITE_2103             |
| failure               | `failure-already-friends`        | 이미 친구, 새 링크로 재수락             | 환영 시트 없이 A 피드, 두 번째 보상 없음                  | ALREADY_FRIENDS         |
| failure               | `failure-after-unfriend`         | 친구 끊고 같은 초대자 링크              | 친구만 맺은 시트 또는 이미 수락 안내, 보상 없음           | CONNECTED / INVITE_2104 |
| failure               | `failure-pending-resume`         | 로그인 취소, 앱 재시작, B 로그인        | 환영 시트가 이어짐                                        | -                       |
| failure               | `failure-pending-wrong-account`  | 보류 후 A로 로그인                      | 환영 시트 없음, API상 초대한 친구 0명                     | -                       |
| failure (fill-a)      | `failure-friend-limit-requested` | A 한도, B 수락                          | `친구 요청을 보냈어요` + 자리 꽉 참 + 보상                | REQUESTED               |
| failure (fill-ab)     | `failure-friend-limit-both-full` | A, B 모두 한도                          | 오류 안내, 카드·수락 버튼 유지                            | INVITE_2106             |
| failure, android-only | `failure-network-error`          | 비행기 모드로 미리보기                  | `초대 정보를 불러오지 못했어요`, 복구 후 `다시 시도` 성공 | -                       |
| flag-off              | `flag-off`                       | 서버 플래그 끔                          | 진입점 숨김, `지금은 초대를 받을 수 없어요`               | INVITE_2105             |
| production-build      | `invite-cold-start-https`        | `https://aido.kr/i/<코드>`              | 초대 카드 (운영 빌드·운영 데이터 필요)                    | -                       |

플랫폼 메모: https 링크는 AASA에 운영 앱만 등록돼 dev/preview에서 열리지 않는다(개발 빌드는 `aido-dev://invite/<코드>`).
iOS 시뮬레이터에서 `openLink`가 universal link를 넘기지 못하면 `xcrun simctl openurl booted https://aido.kr/i/<코드>`.
iOS는 Maestro `back`이 동작하지 않아 왼쪽 위 영역을 탭한다. 비행기 모드는 Android 전용이며, `adb reverse` 경로가
끊기지 않으면 오류 카드가 뜨지 않을 수 있다(그땐 `docker compose stop api` 후 수동 확인).

## 기능 플래그 끄기 (`flag-off`)

`apps/api/.env`의 `INVITE_ENABLED=false`로 로컬 API만 다시 시작하고(`pnpm docker:up` 또는 서버 재시작), 앱을 새로 띄운 뒤
`maestro:release-1.13.0:flag-off`를 실행한다. 확인이 끝나면 `true`로 되돌린다.

## 상태 초기화

- 앱: 각 flow가 `clearState`(iOS는 `clearKeychain`)로 시작한다.
- 서버: `maestro:accounts reset`(B 수락 이력), `clear-friends`(더미), 전부 지우려면 `delete` 후 `create`.
- 시뮬레이터가 이상하면 앱 삭제 후 재설치.

## 필요한 testID (앱에 추가 대기)

`invite-code-input`, `invite-code-submit`, `invite-code-error`, `invite-code-paste`, `my-invite-code`,
`my-invite-rotate`, `invite-share-kakao`, `invite-share-copy-link`, `invite-share-system`, `invitees-see-all`,
`invitees-tab-all`, `invitees-tab-waiting`, `invite-card-signup`, `invite-card-login`, `invite-card-redeem`,
`invite-card-open-my-invite`, `invite-result-enter-code`, `invite-result-retry`, `invite-welcome-sheet`,
`invite-welcome-later`, `friends-empty-invite`, `mypage-invite-card`, `feature-guide-open`,
`feature-discovery-invite-cta`, `friend-delete`, `friend-delete-confirm`.
친구 목록의 편집 버튼은 헤더 툴바 버튼이라 testID를 받지 않아 접근성 라벨(`list.edit`: `편집`/`Edit`)로 누른다.
이메일 로그인(`email-login-*`)은 기존 testID를 쓴다. 로그인 시작의 `이메일로 로그인` 버튼은 1.11.0과 같이 텍스트로 누른다.

## 자동화하지 않는 케이스

| 케이스                                     | 이유           | 대신 확인하는 곳                                    |
| ------------------------------------------ | -------------- | --------------------------------------------------- |
| 카카오톡·시스템 공유 시트 동작             | 외부 앱        | 수동 QA(공유 문구·카드 열기)                        |
| 수락 7일 만료(`INVITE_REDEEM_WINDOW_DAYS`) | 시간 경과      | API unit/integration (invite redemption, 만료 정책) |
| 14일 자격 만료, 월·총 보상 상한            | 시간 경과·누적 | API unit/integration (reward/qualification 정책)    |
| 실제 스토어 구독 결제와의 연계             | 결제 환경      | 클라이언트 릴리스 QA 문서                           |

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
태그가 없어 `run.sh`와 태그 실행에는 포함되지 않는다.
