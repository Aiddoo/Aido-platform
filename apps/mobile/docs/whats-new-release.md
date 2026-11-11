# 새로운 기능 출시 체크리스트

마이 메뉴 "새로운 기능"의 목록과 출시별 소개(Steps)를 더할 때 따른다. 코드는 `features/app-config/whats-new`이고, 서버 설정 조회(`apis/whats-new-campaign.api.ts`·`queries/whats-new-campaign.queries.ts`)도 여기 있다.

## 목록과 소개

목록은 바뀐 점 알림이 아니라 "지금 아이두에서 쓸 수 있는 좋은 기능" 모음이다. 제목은 사용자가 얻는 것을 해요체로 앞세운다. 기능의 혜택·화면이 나중에 바뀌면 카드 문구를 지금 사실로 고치고, 지난 내역은 패치 노트가 맡는다.

| 무엇                  | 어디                                                              | 얼마나 남기나                                                                         |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 목록 줄(데이터)       | `constants/releases.ts`의 `RELEASE_x_y_z`, `RELEASES`             | 기능 출시마다 하나씩 쌓고 지우지 않는다. 최신이 앞이다                                |
| 여러 단계 소개(Steps) | `components/release-x-y-z-steps.tsx`, 모델의 `TOUR_RELEASE_IDS`   | 최근 두 출시만. 세 번째 출시가 나오면 가장 오래된 소개 코드를 지우고 목록 줄은 남긴다 |
| 바로 해 보기(`cta`)   | 목록 줄의 `cta`(타입 있는 Expo Router `href` + 기능 키)           | 소개가 빠진 줄을 누르면 이 화면으로 바로 간다                                         |
| 전체 업데이트 내역    | 목록 아래 줄이 앱 안 브라우저로 여는 패치 노트(`PATCH_NOTES_URL`) | 고친 점까지 모든 출시. 앱 목록은 기능 출시만 담는다                                   |

목록 줄은 데이터만 갖는다: `id`(route·지표 키), `version`·`releasedOn`(패치 노트), `titleKey`·`descriptionKey`, `requiresInvite`, 선택 `cta`, 서버가 자동으로 열 수 있는 출시에만 `campaignId`. 줄은 기능이 주인공이고 버전·날짜(`v1.13.0 · 10월 27일 업데이트`)는 아래 조용한 글자다. 쓸 수 없는 기능(초대 꺼짐)의 줄은 누를 수 없게 두지 않고 `WhatsNewPolicy.canViewRelease`로 숨긴다. 소개는 `WhatsNewPolicy.findTourId`가 `TOUR_RELEASE_IDS`로 찾는다. 소개가 없는 id로 `/whats-new`에 들어오면 최신 소개를 연다.

## 운영이 띄울 소개를 고르는 법

서버 `GET /v1/app-config/feature-discovery`가 env로 정하고, 앱은 응답의 `campaignId`와 같은 `campaignId`를 가진 출시를 찾는다. 앱이 모르는 id면 띄우지 않는다. 그래서 1.15.1 앱에서도 운영이 1.15.0 소개를 계속 띄울 수 있다. v1 응답 계약은 바꾸지 않는다(구 앱이 엄격하게 검사한다).

| env                                 | 뜻                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `FEATURE_DISCOVERY_ENABLED`         | 끄면 자동 열기, 새 기능 표시, 피드 카드가 모두 없다. 목록과 소개는 그대로 열린다   |
| `FEATURE_DISCOVERY_CAMPAIGN_ID`     | 띄울 출시의 `campaignId`(지금 `feature-discovery-2026-12` = 1.15.0)                |
| `FEATURE_DISCOVERY_MIN_APP_VERSION` | 그 소개를 번들한 첫 앱 버전. 낮은 앱은 열지 않는다                                 |
| `FEATURE_DISCOVERY_AUTO_OPEN`       | 끄면 자동으로 열지 않고 목록에서만 연다                                            |
| `FEATURE_DISCOVERY_LAUNCHED_AT`     | 켜면 필수. 1.15.0 이하 앱만 읽고(그 전 가입자에게만 자동), 1.15.1 앱은 읽지 않는다 |

## 출시 체크리스트

1. 소개 파일(`components/release-x-y-z-steps.tsx`)과 `RELEASES` 줄을 더한다. 버전·날짜는 패치 노트, 자동으로 열 출시면 `campaignId`를 둔다.
2. 출시 때 운영 env `FEATURE_DISCOVERY_CAMPAIGN_ID`·`FEATURE_DISCOVERY_MIN_APP_VERSION`을 새 값으로 바꾼다. 서버를 먼저 배포한다.
3. 다음 출시에서 최근 두 출시 밖으로 밀린 소개 코드를 지운다. 목록 줄은 남기고 누르면 `cta` 화면으로 간다.

## 자세한 순서

1. `domains/whats-new.model.ts`의 출시 id(`releaseIdSchema`)와 소개 출시(`TOUR_RELEASE_IDS`) 맨 앞에 넣고, `constants/whats-new.constants.ts`의 `RELEASE_ID`에 코드에서 부를 이름을 한 줄 더한다. 세 개가 되면 맨 뒤를 빼고 그 소개 파일, `app/(app)/whats-new/index.tsx`의 `match` 갈래, 소개에만 쓰던 문구(`v{x_y_z}.{단계}`)를 지운다. 목록 줄 문구(`v{x_y_z}.release`)는 남긴다.
2. `constants/releases.ts`에 `RELEASE_x_y_z`를 더하고 `RELEASES` 맨 앞에 넣는다. `version`과 `releasedOn`은 [패치 노트](https://aido.kr/ko/patch-notes)에서 그 기능이 나온 버전·날짜를 그대로 쓴다. `id`는 route·지표·stepper 키라 한 번 정하면 바꾸지 않고 버전을 읽어 내지도 않는다(1.14 앱에 처음 넣은 친구 초대 소개는 id `1.14.0`, 버전 `1.13.0`). `cta`는 그 기능을 바로 쓸 화면이다. 자동으로 열 출시에만 `campaignId`(운영 `FEATURE_DISCOVERY_CAMPAIGN_ID` 값)를 둔다. 캠페인 id는 이 한 곳에만 있다. `releases.test.ts`가 버전 순서, 최근 두 출시의 소개, 캠페인 출시의 소개를 확인한다.
3. `components/release-x-y-z-steps.tsx`를 만들고 `app/(app)/whats-new/index.tsx`의 `match`에 잇는다. `TOUR_RELEASE_IDS`를 바꾸면 `exhaustive()`가 컴파일 에러로 알려 준다.
4. `app/(app)/(tabs)/(mypage)/whats-new/releases.tsx`의 맨 위에 `<ReleaseRow />` 한 줄을 더한다.
5. 장면은 화면 캡처 대신 실제 기능 부품으로 그린 예시다. `WhatsNewStep.Stage`에 기능 컴포넌트를 예시 값으로 올리고, 예시 글은 `whatsNew` 카탈로그(`v{x_y_z}.demo`)에 둔다. 마이크·네트워크·저장은 쓰지 않는다. 대본은 `useDemoScript`로 장면마다 한 번 돌고, 움직임 줄이기면 마지막 장면부터 보인다. 음량을 받는 음성 부품(`VoiceVisual`·`RecognizerWaveform`)에는 `useDemoVoiceLevel`의 UI 스레드 예시 음량을 넣고, 말이 끝나면 `isActive`를 꺼 프레임 콜백을 멈춘다. 계속 도는 움직임은 지금 보이는 단계에만 두고 한 장면에 눈에 띄는 움직임은 하나다.
6. `locales/{ko,en}/whats-new.json`에 문구를 넣는다. 제목 1줄(약 14자), 설명 1~2줄(약 40자)이다.
7. `constants/whats-new.events.ts`와 측정 문서를 확인한다. CTA 뒤 실제 사용은 `trackAttributedFeatureSuccess`로 잇는다.
8. 운영 설정 `FEATURE_DISCOVERY_CAMPAIGN_ID`, `MIN_APP_VERSION`, `LAUNCHED_AT`, `AUTO_OPEN`을 바꾼다. 서버를 먼저 배포한다. `LAUNCHED_AT`은 켜면 필수라 계속 채우지만 1.15.0 이하 앱만 읽는다. 1.15.1부터 앱 모델(`WhatsNewCampaignConfig`)에 옮기지 않는다. 시작 체크리스트는 캠페인과 상관없이 가입 7일 동안 보인다.
9. 지난 캠페인 출시의 `campaignId`를 지워 목록에서만 열리게 한다. 그 캠페인의 본 기록·재진입 키는 다음 시작 때 지워진다.

## 동작 규칙

| 규칙                      | 구현                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 계정·캠페인별 한 번       | `aido_feature_discovery_seen_v1:{userId}:{campaignId}`. 동기 claim                                                                                                                    |
| 가입 시점과 상관없이 자동 | `WhatsNewPolicy.shouldAutoOpen(release, …)`: 서버 `enabled`·`autoOpen`, 이 출시의 캠페인, 지원 버전, 안 봄. 새 계정도 한 번 본다. 1.15.0 이하 앱은 `launchedAt` 전 가입자에게만 연다  |
| 다른 안내와 겹치지 않음   | `useStableFeedForeground`(피드가 앞에 자리 잡은 뒤). 날씨 위치는 자동으로 묻지 않는다                                                                                                 |
| 알림 화면 다음에 연다     | 피드가 `usePushOnboardingGuardState() === 'closed'`를 `isOnboardingSettled`로 넘긴다. 아래 순서를 따른다                                                                              |
| 말풍선은 그 다음          | `useWhatsNewAutoOpen`의 `shouldShowCoachmarks`(`utils/should-show-coachmarks.ts`)를 피드가 친구 줄·달력 안내에 넘긴다. 설정을 받는 중이거나 자동으로 열 차례면 기다린다               |
| 기능으로 떠나기           | `leaveTo`(`dismissTo`)로 기능이 사는 탭에서 연다. 말로 할 일 만들기는 `/feed?action=add-voice-todo`로 오늘의 내 피드 위에 시트를 열어 만든 할 일이 뒤에 보인다                        |
| 다시 열기                 | 피드 카드 14일(`aido_feature_discovery_reentry_v1:{userId}:{campaignId}`), 마이 메뉴 상시                                                                                             |
| 새 기능 표시·메뉴 점      | `useUnseenCampaignReleaseId`(`useWhatsNewCampaign`의 조회를 공유): 서버 캠페인이 가리키는 출시를 아직 보지 않았을 때만 그 줄에 "새 기능", 마이 메뉴에 점. 지난 출시에는 붙이지 않는다 |
| 캠페인 없는 소개          | 목록에서만 연다. 본 기록·`feature_hub_*`·`feature_card_cta`·기능 귀속을 남기지 않고 `whats_new_*`만 남긴다                                                                            |
| 버전 표시                 | 목록 줄은 `v1.15.0 · 11월 10일 업데이트`, Steps 머리는 `v1.15.0`. 읽기 라벨은 "버전 1.15.0"이다                                                                                       |
| 오프라인, 서버 실패       | 목록과 Steps는 번들이라 그대로 열린다. 설정을 못 받으면 자동으로 열지 않는다                                                                                                          |

## 첫 피드의 자동 화면 순서

피드가 앞에 자리 잡은 뒤(`isStable`) 자동 화면은 한 번에 하나만 연다. 다른 route·시트·overlay가 위에 있으면 피드가 앞에 있지 않아 기다린다.

1. **알림 화면** `/onboarding/notifications`: `(app)/_layout`의 `usePushOnboardingGuard`가 내 정보와 OS 권한을 읽고 정한다. 읽기 전에는 guard 값이 `null`이라 어느 자동 화면도 열지 않는다. 권한을 읽지 못하면 알림 화면을 띄울 수 없으므로 열 차례가 아닌 것(`false`)으로 정한다.
2. **새로운 기능** `/whats-new`: guard가 `false`로 그려진 뒤에만 연다. 알림 화면에 답하면 guard가 닫혀 화면이 빠지고, 피드가 다시 앞에 자리 잡을 때 연다. 열기 직전에 본 기록을 claim하므로 닫은 뒤 다시 자동으로 열리지 않는다.
3. **말풍선**: 알림 화면을 열 차례가 아니라고 정해지고, 캠페인 설정을 다 받았고(실패·오프라인이면 열지 않는 것으로 본다), 새로운 기능을 자동으로 열 차례가 아닐 때만 띄운다(`shouldShowCoachmarks`). 450ms 기다림만으로는 설정이 늦게 오면 말풍선이 먼저 뜨고 새로운 기능이 그 위에 열린다. 열 차례가 되면 자리를 처음부터 다시 재므로(`CoachmarkPopover`의 `shouldAutoOpen`), 새로운 기능이 바로 덮으면 열리지 않고 닫고 피드로 돌아온 뒤 열린다. 이미 본 계정은 설정을 받자마자 기다리지 않는다.

## 키 정리

키를 쓰는 feature의 repository가 지운다. `bootstrap/startup/startup-key-cleanup.ts`가 앱 시작 때 한 번 부르고, 실패해도 앱을 막지 않고 Logger에 남긴다.

| 대상                                                        | 정리                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| `RELEASES`의 `campaignId`에 없는 캠페인의 본 기록·재진입 키 | 앱 시작 때                                                     |
| 14일 지난 재진입 키                                         | 앱 시작 때                                                     |
| `RETIRED_COACHMARK_KINDS`의 말풍선 키                       | 앱 시작 때. 이미 본 사람에게 다시 뜰 일이 없어진 뒤에만 올린다 |
| 그 계정의 안내 키                                           | 탈퇴 때. 로그아웃은 같은 사람이 돌아오므로 남긴다              |
| 1.15.0 이하의 시작 체크리스트 키 `aido_activation_v1:*`     | 앱 시작 때. 1.15.1부터 계정별 `aido_activation_v2:{accountId}` |

`aido_activation_v2`, 위젯, SecureStore 키는 지우지 않는다. 키를 바꾸면서 가입 7일 안 계정의 기기 체크 기록이 비지만, 체크리스트 단계는 서버 할 일 기록으로 다시 채워진다.

## 화면 확인

폴드 접힘·펼침, 글꼴 5단계에서 CTA 닿음, 다크, 움직임 줄이기, Android 뒤로 가기, iOS 스와이프 뒤로 가기, 연타, 오프라인, ko·en을 기기에서 본다.
