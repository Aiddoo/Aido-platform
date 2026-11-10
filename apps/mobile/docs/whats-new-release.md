# 새로운 기능 출시 체크리스트

마이 메뉴 "새로운 기능"의 목록과 출시별 소개(Steps)를 더할 때 따른다. 코드는 `features/app-config/whats-new`, 서버 설정 조회는 `features/app-config/feature-campaign`이다.

## 목록과 소개

목록은 바뀐 점 알림이 아니라 "지금 아이두에서 쓸 수 있는 좋은 기능" 모음이다. 제목은 사용자가 얻는 것을 해요체로 앞세운다. 기능의 혜택·화면이 나중에 바뀌면 카드 문구를 지금 사실로 고치고, 지난 내역은 패치 노트가 맡는다.

| 무엇                  | 어디                                                              | 얼마나 남기나                                                                         |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 목록 줄(데이터)       | `constants/releases.ts`의 `RELEASE_x_y_z`, `RELEASES`             | 기능 출시마다 하나씩 쌓고 지우지 않는다. 최신이 앞이다                                |
| 여러 단계 소개(Steps) | `components/release-x-y-z-steps.tsx`, `TOUR_RELEASE_IDS`          | 최근 두 출시만. 세 번째 출시가 나오면 가장 오래된 소개 코드를 지우고 목록 줄은 남긴다 |
| 바로 해 보기(`cta`)   | 목록 줄의 `cta`(타입 있는 Expo Router `href` + 기능 키)           | 소개가 빠진 줄을 누르면 이 화면으로 바로 간다                                         |
| 전체 업데이트 내역    | 목록 아래 줄이 앱 안 브라우저로 여는 패치 노트(`PATCH_NOTES_URL`) | 고친 점까지 모든 출시. 앱 목록은 기능 출시만 담는다                                   |

목록 줄은 데이터만 갖는다: `id`(route·지표 키), `version`·`releasedOn`(패치 노트), `titleKey`·`descriptionKey`, `requiresInvite`, 선택 `cta`, 서버가 자동으로 열 수 있는 출시에만 `campaignId`. 줄은 기능이 주인공이고 버전·날짜(`v1.13.0 · 10월 27일 업데이트`)는 아래 조용한 글자다. 쓸 수 없는 기능(초대 꺼짐)의 줄은 누를 수 없게 두지 않고 `WhatsNewPolicy.canViewRelease`로 숨긴다. 소개는 `WhatsNewPolicy.findTourId`가 `TOUR_RELEASE_IDS`로 찾는다. 소개가 없는 id로 `/whats-new`에 들어오면 최신 소개를 연다.

## 출시마다 할 일

1. `constants/whats-new.constants.ts`의 `RELEASE_ID`에 한 줄 더하고 `TOUR_RELEASE_IDS` 맨 앞에 넣는다. 세 개가 되면 맨 뒤를 빼고 그 소개 파일, `app/(app)/whats-new/index.tsx`의 `match` 갈래, 소개에만 쓰던 문구(`v{x_y_z}.{단계}`)를 지운다. 목록 줄 문구(`v{x_y_z}.release`)는 남긴다.
2. `constants/releases.ts`에 `RELEASE_x_y_z`를 더하고 `RELEASES` 맨 앞에 넣는다. `version`과 `releasedOn`은 [패치 노트](https://aido.kr/ko/patch-notes)에서 그 기능이 나온 버전·날짜를 그대로 쓴다. `id`는 route·지표·stepper 키라 한 번 정하면 바꾸지 않고 버전을 읽어 내지도 않는다(1.14 앱에 처음 넣은 친구 초대 소개는 id `1.14.0`, 버전 `1.13.0`). `cta`는 그 기능을 바로 쓸 화면이다. 자동으로 열 출시에만 `campaignId`를 두고 `feature-campaign.constants.ts`에 그 id를 둔다. `releases.test.ts`가 버전 순서, 최근 두 출시의 소개, 캠페인 출시의 소개를 확인한다.
3. `components/release-x-y-z-steps.tsx`를 만들고 `app/(app)/whats-new/index.tsx`의 `match`에 잇는다. `TOUR_RELEASE_IDS`를 바꾸면 `exhaustive()`가 컴파일 에러로 알려 준다.
4. `app/(app)/(tabs)/(mypage)/whats-new/releases.tsx`의 맨 위에 `<ReleaseRow />` 한 줄을 더한다.
5. 장면은 화면 캡처 대신 실제 기능 부품으로 그린 예시다. `WhatsNewStep.Stage`에 기능 컴포넌트를 예시 값으로 올리고, 예시 글은 `whatsNew` 카탈로그(`v{x_y_z}.demo`)에 둔다. 마이크·네트워크·저장은 쓰지 않는다. 대본은 `useDemoScript`로 장면마다 한 번 돌고, 움직임 줄이기면 마지막 장면부터 보인다. 음량을 받는 음성 부품(`VoiceVisual`·`RecognizerWaveform`)에는 `useDemoVoiceLevel`의 UI 스레드 예시 음량을 넣고, 말이 끝나면 `isActive`를 꺼 프레임 콜백을 멈춘다. 계속 도는 움직임은 지금 보이는 단계에만 두고 한 장면에 눈에 띄는 움직임은 하나다.
6. `locales/{ko,en}/whats-new.json`에 문구를 넣는다. 제목 1줄(약 14자), 설명 1~2줄(약 40자)이다.
7. `constants/whats-new.events.ts`와 측정 문서를 확인한다. CTA 뒤 실제 사용은 `trackAttributedFeatureSuccess`로 잇는다.
8. 운영 설정 `FEATURE_DISCOVERY_CAMPAIGN_ID`, `MIN_APP_VERSION`, `LAUNCHED_AT`, `AUTO_OPEN`을 바꾼다. 서버를 먼저 배포한다. 1.15.1부터 새로운 기능은 `LAUNCHED_AT`을 보지 않는다(1.15.0 이하 앱과 시작 체크리스트가 읽는다).
9. 지난 캠페인 출시의 `campaignId`를 지워 목록에서만 열리게 한다. 그 캠페인의 본 기록·재진입 키는 다음 시작 때 지워진다.

## 동작 규칙

| 규칙                      | 구현                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 계정·캠페인별 한 번       | `aido_feature_discovery_seen_v1:{userId}:{campaignId}`. 동기 claim                                                                                                                   |
| 가입 시점과 상관없이 자동 | `WhatsNewPolicy.shouldAutoOpen(release, …)`: 서버 `enabled`·`autoOpen`, 이 출시의 캠페인, 지원 버전, 안 봄. 새 계정도 한 번 본다. 1.15.0 이하 앱은 `launchedAt` 전 가입자에게만 연다 |
| 다른 안내와 겹치지 않음   | `useStableFeedForeground`(피드가 앞에 자리 잡은 뒤). 날씨 위치는 자동으로 묻지 않는다                                                                                                |
| 알림 화면 다음에 연다     | 피드가 `useIsPushOnboardingGuardClosed()`를 `isOnboardingSettled`로 넘긴다. 아래 순서를 따른다                                                                                       |
| 다시 열기                 | 피드 카드 14일(`aido_feature_discovery_reentry_v1:{userId}:{campaignId}`), 마이 메뉴 상시                                                                                            |
| 새 기능 표시·메뉴 점      | `useUnseenCampaignReleaseId`: 서버 캠페인이 가리키는 출시를 아직 보지 않았을 때만 그 줄에 "새 기능", 마이 메뉴에 점. 지난 출시에는 붙이지 않는다                                     |
| 캠페인 없는 소개          | 목록에서만 연다. 본 기록·`feature_hub_*`·`feature_card_cta`·기능 귀속을 남기지 않고 `whats_new_*`만 남긴다                                                                           |
| 버전 표시                 | 목록 줄은 `v1.15.0 · 11월 10일 업데이트`, Steps 머리는 `v1.15.0`. 읽기 라벨은 "버전 1.15.0"이다                                                                                      |
| 오프라인, 서버 실패       | 목록과 Steps는 번들이라 그대로 열린다. 설정을 못 받으면 자동으로 열지 않는다                                                                                                         |

## 첫 피드의 자동 화면 순서

피드가 앞에 자리 잡은 뒤(`isStable`) 자동 화면은 한 번에 하나만 연다. 다른 route·시트·overlay가 위에 있으면 피드가 앞에 있지 않아 기다린다.

1. **알림 화면** `/onboarding/notifications`: `(app)/_layout`의 `usePushOnboardingGuard`가 내 정보와 OS 권한을 읽고 정한다. 읽기 전에는 guard 값이 `null`이라 어느 자동 화면도 열지 않는다. 권한을 읽지 못하면 알림 화면을 띄울 수 없으므로 열 차례가 아닌 것(`false`)으로 정한다.
2. **새로운 기능** `/whats-new`: guard가 `false`로 그려진 뒤에만 연다. 알림 화면에 답하면 guard가 닫혀 화면이 빠지고, 피드가 다시 앞에 자리 잡을 때 연다. 열기 직전에 본 기록을 claim하므로 닫은 뒤 다시 자동으로 열리지 않는다.
3. **말풍선**: 피드에 포커스가 있을 때 450ms 뒤에 뜨므로 위 두 화면을 닫은 뒤에 보인다.

## 키 정리

키를 쓰는 feature의 repository가 지운다. `bootstrap/startup/startup-key-cleanup.ts`가 앱 시작 때 한 번 부르고, 실패해도 앱을 막지 않고 Logger에 남긴다.

| 대상                                                        | 정리                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `RELEASES`의 `campaignId`에 없는 캠페인의 본 기록·재진입 키 | 앱 시작 때                                                     |
| 14일 지난 재진입 키                                         | 앱 시작 때                                                     |
| `RETIRED_COACHMARK_KINDS`의 말풍선 키                       | 앱 시작 때. 이미 본 사람에게 다시 뜰 일이 없어진 뒤에만 올린다 |
| 그 계정의 안내 키                                           | 탈퇴 때. 로그아웃은 같은 사람이 돌아오므로 남긴다              |

`aido_activation_v1`, 위젯, SecureStore 키는 지우지 않는다.

## 화면 확인

폴드 접힘·펼침, 글꼴 5단계에서 CTA 닿음, 다크, 움직임 줄이기, Android 뒤로 가기, iOS 스와이프 뒤로 가기, 연타, 오프라인, ko·en을 기기에서 본다.
