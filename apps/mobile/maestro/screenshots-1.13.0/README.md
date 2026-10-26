# 1.13.0 전체 화면 캡처

랜딩·스토어 이미지에도 쓰는 화면 모음을 기기 × 계정(일반/프리미엄) × 테마(라이트/다크) × 언어로 찍는다.
로컬 Docker API와 로컬 빌드 앱에서만 실행한다. 데모 데이터 스크립트와 흐름의 API 호출은 localhost 계열이 아니면
시작 전에 멈춘다(`release-1.13.0`의 `maestro-accounts.ts`, `lib.js`와 같은 규칙).

화면 목록과 번호: [SCREENS.md](SCREENS.md).

## 실행

```sh
pnpm --filter mobile maestro:screens seed all      # 데모 계정 + AI 생성(약 10~15분). ko만이면 seed ko
pnpm --filter mobile maestro:screens status all    # 계정·리포트·제안이 AI로 만들어졌는지 확인
pnpm --filter mobile maestro:screens:capture -- --skip-seed --build "1.13.0 (local release)"
pnpm --filter mobile maestro:screens reset all     # 끝나면 데모 계정 삭제
```

- `capture.sh`는 `--skip-seed`가 없으면 `seed ko`(iPhone 17 Pro가 포함되면 `seed en`도)를 먼저 돌린다.
- 일부만: `--devices iphone17pro,android --roles premium --themes dark`. 기기 키: `iphone17pro`, `iphonese`, `duo`(접힘·펼침),
  `android`(Medium_Phone_API_36.1), `fold`(7.6" Fold-in 접힘·펼침), `flip`(6.7" 플립, 기본 목록 밖).
- 결과: `~/Desktop/Aido-Screens-1.13.0/<기기>/<일반|프리미엄>/<라이트|다크>[/en]/NN_화면명.png`와 같은 폴더의
  `README.md`(날짜, 앱 버전, 빌드, 폴더별 장수, AI 생성 여부). `SCREENS_OUT`으로 바꿀 수 있다.
- 한 flow만 직접 돌리려면 `capture.sh`가 내보내는 `MAESTRO_SHOT_*` 변수를 같은 이름으로 shell에 올린 뒤
  `maestro test --include-tags premium 30-ai.yaml`.

## 준비

1. 1.13.0 스택이 합쳐진 앱과 서버. 서버는 `INVITE_ENABLED=true`, job worker(pg-boss) 동작, AI 키는 로컬 API 환경 변수에만
   둔다(스크립트는 키를 읽지도 출력하지도 않는다). 기능 소개(05·72)는 서버 캠페인 설정이 켜져 있어야 보인다.
2. 앱은 개발 메뉴가 찍히지 않게 **Release 구성 로컬 빌드**를 쓴다(`EXPO_PUBLIC_API_URL=http://localhost:8080`, 스킴 `aido-dev`).
   설치돼 있지 않은 기기에는 `SCREENS_IOS_APP=<.app>`, `SCREENS_ANDROID_APK=<.apk>`로 넣는다. Android는 `adb reverse 8080`을 스크립트가 건다.
3. 무료 페이월(79)은 RevenueCat 샌드박스 키가 든 빌드에서만 요금제가 보인다. 없으면 '요금제를 불러오지 못했어요'와 문의하기가 찍힌다.
4. 호스트 시간대는 Asia/Seoul로 둔다(데모 날짜와 기기 '오늘'을 맞춘다). 날짜는 실행일 기준이라 언제 돌려도 '오늘/이번 주'가 맞다.

## 데모 데이터 (`scripts/demo-seed.ts`, 내용은 `scripts/demo-content.json`)

계정은 실제 가입 API로 만들고 이메일 인증만 로컬 DB에서 표시한다. 비밀번호는 무작위로 만들어 gitignore된 `.env.screens`에만 쓴다.
친구·과거 기록처럼 API로 만들 수 없는 것(지난 날짜 완료, 활동일, 보상 지급 결과)은 로컬 DB에 실제 지급 결과와 같은 행으로 넣는다.

| 언어 | 계정                 | 이메일(@demo.aido.kr) | 내용                                                                                                |
| ---- | -------------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| ko   | 민지(프리미엄)       | `minji.kim`           | 20대 후반 직장인. 5주 기록, 화·목 필라테스, 영어 스터디, 디자인 리뷰, 고양이 '두부', 제주 여행 준비 |
| ko   | 민지(일반)           | `kim.minji`           | 10일 기록, 카테고리 3개, 친구 5명(한도), 이번 달 AI 5회 소진                                        |
| ko   | 서연(초대 보상)      | `seoyeon.lee`         | 민지의 초대로 가입, 보상 프리미엄이 내일 끝남(D-1)                                                  |
| ko   | 지우(새 계정)        | `jiwoo.han`           | 빈 상태(90~95)와 초대 수락(85~86)용                                                                 |
| en   | Mina / Grace / Lucas | `mina.park` 등        | 같은 이야기를 자연스러운 영어로                                                                     |

- 친구 6~7명(지훈·하늘·유진·도윤·수아·하린 / Jake·Olivia·Chloe·Ethan·Ryan·Lily)은 서로 다른 고양이 아이콘이고, 오늘 할 일 일부를 끝냈다.
  유진은 오늘 할 일을 모두 끝냈다. 지훈이 민지의 '서연이 생일 선물 고르기'에 메시지와 함께 콕을 보냈고, 수아가 응원을 보냈다.
- 초대: 서연·지훈은 발자국이 찍혔고(민지 보상은 스토어 구독 중이라 BANKED, 친구 한도 +2), 하린은 활동 1일(D-1)로 대기 중이다.
  태오(Noah)가 민지에게 친구 요청을 보냈고, 무료 계정은 태오를 추가하려다 친구 한도 안내를 본다.
- 알림은 서버 알림 문구 카탈로그(`notification/.../locales`)와 같은 문장으로 넣는다.

### AI로 만드는 화면

`seed` 마지막 단계(또는 `ai`만 다시)가 프리미엄 계정으로 실제 AI 경로를 돌린다.

| 화면                              | 만드는 방법                                                                    | 실패 시 대체                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 10·12·홈 미래 날짜의 AI 할 일 4개 | `POST /v1/ai/parse-todo`로 자연어 문장을 해석해 할 일로 저장                   | 그 문장을 건너뜀(`AI_PARSE_TODO=n/4`)                                                                            |
| 31·32 주간, 33 월간 리포트        | pg-boss `ai-report-generation.v1`에 `generate-report` job → 서버 worker가 생성 | 시간 초과면 집계 + 사람이 쓴 요약 행(`fallback-row`), 서버가 기본 문구를 저장했으면 요약만 교체(`fallback-text`) |
| 34 반복 제안                      | `ai-suggestion-analysis.v1`에 `analyze-suggestion` job                         | 제안 2개 행(`fallback-row`)                                                                                      |
| 23 메모 AI 분석 결과              | 캡처 중 앱에서 `할 일로 변환 → 시작하기`(실제 parse-memo). 저장하지 않는다     | 실패하면 그 장만 빠진다                                                                                          |

어떤 화면이 대체됐는지는 `status`와 결과 폴더 `README.md`의 'AI로 만든 화면'에 남는다. 프리미엄은 AI 한도가 없고,
무료 계정은 일부러 이번 달 횟수를 다 쓴 상태라 AI를 부르지 않는다. 리포트는 서버 규칙대로 지난주·지난달 하나씩만 생긴다.

### 초기화

- `reset [ko|en|all]`: `@demo.aido.kr` 데모 계정과 그 데이터 삭제.
- `reset-newbie <ko|en>`: 85~86에서 소비한 새 계정의 수락·보상·친구 관계와 로컬 `RewardClaim` 전체를 지운다
  (기기 해시에 사용자 연결이 없어서다. `maestro-accounts reset`과 같다). `capture.sh`가 프리미엄 실행마다 자동으로 부른다.
- `seed`는 시작할 때 같은 언어의 데모 계정을 먼저 지우므로 반복 실행해도 된다.

## 기기와 접힘

| 기기            | 준비                                                                           | 접힘 제어                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone 17 Pro   | 기존 시뮬레이터. ko·en 모두 찍는다(언어 변경 시 재부팅)                        | -                                                                                                                                                                                 |
| iPhone SE 3세대 | iOS 27.1은 SE 3세대를 받지 않아 iOS 27.0으로 만들어 둠(없으면 스크립트가 생성) | -                                                                                                                                                                                 |
| iPhone Duo      | 부팅하면 접힘(바깥 화면 1398×2034)                                             | **simctl로 못 바꾼다.** DeviceHub 기기 창의 자세 막대(Poses)에서 완전히 펼침 → Enter. 펼친 안쪽 화면은 2007×2853이며 결과 폭으로 확인한다. `SCREENS_DUO_UNFOLDED=skip`이면 건너뜀 |
| Android 폰      | `Medium_Phone_API_36.1`                                                        | -                                                                                                                                                                                 |
| Android 폴드    | `Aido_Fold_7.6_API_36.1`(기기 id 55, 같은 시스템 이미지)                       | `adb emu fold` / `adb emu unfold`, `wm size`로 확인                                                                                                                               |
| Android 플립    | `Aido_Flip_6.7_API_36.1`(기기 id 52), 선택                                     | 펼친 상태만                                                                                                                                                                       |

- 상태 표시줄: iOS `simctl status_bar override`(9:41, 배터리 100%), Android SystemUI 데모 모드(9:41, 알림 아이콘 숨김).
- 테마: iOS `simctl ui appearance`, Android `cmd uimode night`.
- 이 Mac에서는 에뮬레이터가 하나 켜져 있으면 두 번째 에뮬레이터가 HVF를 받지 못해(`hvf is not enabled`) qemu `mprotect`
  오류로 부팅이 멈춘다. 스크립트는 자기가 띄운 에뮬레이터를 기기마다 끄고, 원래 켜져 있던 에뮬레이터는
  `SCREENS_STOP_OTHER_EMULATORS=1`일 때만 끈다(아니면 경고만 한다).

## 실행 시간(예상)

seed 언어당 약 5~8분(가입 API 분당 5회 제한 + AI job 대기 최대 5분). 캡처 실행 1회(기기·계정·테마·언어 하나) 약 6~9분.
기본 기기 전체는 16회라 약 2~2.5시간 + Duo 펼침 수동 1회.

## 예상 장수

실행 1회당 일반 40장, 프리미엄 43장(첫 로그인 기능 소개가 자동으로 뜨면 각 +1).
기기·언어 조합 8개(iPhone 17 Pro ko/en, SE, Duo 접힘/펼침, Android 폰, 폴드 접힘/펼침) × 테마 2 × 83장 = **1,328장**
(+ 기능 소개 자동 최대 32장, 플립 포함 시 +166장).

## 선택자와 testID

화면 이동은 딥링크(`subflows/open.yaml`), 탭·대기는 testID를 우선 쓴다. 쓰는 testID(조립된 스택에 있음):
`email-login-*`, `todo-detail`, `invite-card-signup`, `invite-card-redeem`, `invite-welcome-sheet`, `my-invite-code`,
`invitees-see-all`, `invitees-tab-waiting`, `mypage-invite-card`, `feature-guide-open`, `friends-empty-invite`.

testID가 없어 문구(ko|en 정규식)로 누르는 곳. 추가하면 언어와 무관해진다(앱 코드는 이 작업에서 고치지 않았다):

| 제안 testID                                | 위치                                  | 흐름         |
| ------------------------------------------ | ------------------------------------- | ------------ |
| `todo-ai-feature-tooltip`                  | 할 일 추가 시트 `AI로 할 일 만들기`   | 13-todo      |
| `todo-ai-parse`                            | 추가 시트 마이크 버튼(무료 한도 안내) | 미사용(수동) |
| `memo-convert-to-todo`                     | 메모 상세 `할 일로 변환`              | 20-memo      |
| `memo-ai-start`                            | AI 변환 확인 `시작하기`               | 20-memo      |
| `memo-ai-review`                           | AI 분석 결과 화면                     | 20-memo      |
| `friends-tab-received`                     | 친구 목록 받은 요청 탭                | 40-friends   |
| `friend-search-input`, `friend-search-add` | 친구 찾기 입력·추가                   | 40-friends   |
| `feature-discovery-close`                  | 기능 가이드 닫기                      | settle, 70   |
| `report-detail`                            | 리포트 상세                           | 30-ai        |
| `subscription-screen`                      | 구독 화면 각 pane                     | 70, 80       |
| `store-review-later`                       | 스토어 리뷰 안내 `다음에`             | settle       |

## 자동으로 찍지 않는 화면

SCREENS.md의 번호 `—` 행. 대표적으로 AI 음성 파싱 결과(시뮬레이터 음성 입력 없음), 스토어 리뷰 안내(기기 날짜 2일 필요),
카카오·시스템 공유 시트(외부 앱), 앱 오류 화면(서버 중단 필요).
