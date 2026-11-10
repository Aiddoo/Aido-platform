# 새로운 기능 출시 체크리스트

마이 메뉴 "새로운 기능"의 목록과 출시별 Steps를 더할 때 따른다. 코드는 `features/app-config/whats-new`, 서버 설정 조회는 `features/app-config/feature-campaign`이다.

## 출시마다 할 일

1. `schemas/release-entry.schema.ts`의 `RELEASE_ID`에 한 줄 더한다.
2. `constants/releases.ts`에 `RELEASE_x_y_z`와 `RELEASES` 항목을 더한다. `version`과 `releasedOn`은 [패치 노트](https://aido.kr/ko/patch-notes)에서 그 기능이 나온 버전·날짜를 그대로 쓴다. `id`는 route·지표·stepper 키라 한 번 정하면 바꾸지 않고 버전을 읽어 내지도 않는다(1.14 앱에 더한 친구 초대 소개는 id `1.14.0`, 버전 `1.13.0`). 늦게 나온 출시일수록 버전이 높아야 `releases.test.ts`가 통과한다. 캠페인 id가 새로 생기면 `feature-campaign.constants.ts`에도 더한다. 활성화가 그 캠페인을 이어야 하면 `ACTIVATION_CAMPAIGN_IDS`에 올린다.
3. `components/release-x-y-z-steps.tsx`를 만들고 `app/(app)/whats-new/index.tsx`의 `match`에 잇는다. id를 더하면 `exhaustive()`가 컴파일 에러로 알려 준다.
4. `app/(app)/(tabs)/(mypage)/whats-new/releases.tsx`에 `<ReleaseRow />` 한 줄을 더한다.
5. 장면은 화면 캡처 대신 실제 기능 부품으로 그린 예시다. `WhatsNewStep.Stage`에 기능 컴포넌트를 예시 값으로 올리고, 예시 글은 `whatsNew` 카탈로그(`v{x_y_z}.demo`)에 둔다. 마이크·네트워크·저장은 쓰지 않는다. 대본은 `useDemoScript`로 장면마다 한 번 돌고, 움직임 줄이기면 마지막 장면부터 보인다. 음량을 받는 음성 부품(`VoiceVisual`·`RecognizerWaveform`)에는 `useDemoVoiceLevel`의 UI 스레드 예시 음량을 넣고, 말이 끝나면 `isActive`를 꺼 프레임 콜백을 멈춘다. 계속 도는 움직임은 지금 보이는 단계에만 두고 한 장면에 눈에 띄는 움직임은 하나다.
6. `locales/{ko,en}/whats-new.json`에 문구를 넣는다. 제목 1줄(약 14자), 설명 1~2줄(약 40자)이다.
7. `constants/whats-new.events.ts`와 측정 문서를 확인한다. CTA 뒤 실제 사용은 `trackAttributedFeatureSuccess`로 잇는다.
8. 운영 설정 `FEATURE_DISCOVERY_CAMPAIGN_ID`, `MIN_APP_VERSION`, `LAUNCHED_AT`, `AUTO_OPEN`을 바꾼다. 서버를 먼저 배포한다.
9. 지난 출시의 Steps는 예시를 지우고 글과 간단한 그림으로 줄인다.

## 동작 규칙

| 규칙                    | 구현                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| 계정·캠페인별 한 번     | `aido_feature_discovery_seen_v1:{userId}:{campaignId}`. 동기 claim                                          |
| 기존 가입자만 자동      | `WhatsNewPolicy.shouldAutoOpen`: `user.createdAt < launchedAt`, 지원 버전, 안 봄, 서버 `enabled`·`autoOpen` |
| 다른 안내와 겹치지 않음 | `useStableFeedForeground`(피드가 앞에 자리 잡은 뒤). 날씨 위치는 자동으로 묻지 않는다                       |
| 알림 화면 다음에 연다   | 피드가 `useIsPushOnboardingGuardClosed()`를 `isOnboardingSettled`로 넘긴다. 아래 순서를 따른다              |
| 다시 열기               | 피드 카드 14일(`aido_feature_discovery_reentry_v1:{userId}:{campaignId}`), 마이 메뉴 상시                   |
| 안 본 출시 점           | 최신 출시만 본다. 지난 출시까지 세면 점이 오래 사라지지 않는다                                              |
| 버전 표시               | 목록 줄은 `v1.15.0 · 11월 10일 업데이트`, Steps 머리는 `v1.15.0`. 읽기 라벨은 "버전 1.15.0"이다             |
| 오프라인, 서버 실패     | 목록과 Steps는 번들이라 그대로 열린다. 설정을 못 받으면 자동으로 열지 않는다                                |

## 첫 피드의 자동 화면 순서

피드가 앞에 자리 잡은 뒤(`isStable`) 자동 화면은 한 번에 하나만 연다. 다른 route·시트·overlay가 위에 있으면 피드가 앞에 있지 않아 기다린다.

1. **알림 화면** `/onboarding/notifications`: `(app)/_layout`의 `usePushOnboardingGuard`가 내 정보와 OS 권한을 읽고 정한다. 읽기 전에는 guard 값이 `null`이라 어느 자동 화면도 열지 않는다. 권한을 읽지 못하면 알림 화면을 띄울 수 없으므로 열 차례가 아닌 것(`false`)으로 정한다.
2. **새로운 기능** `/whats-new`: guard가 `false`로 그려진 뒤에만 연다. 알림 화면에 답하면 guard가 닫혀 화면이 빠지고, 피드가 다시 앞에 자리 잡을 때 연다. 열기 직전에 본 기록을 claim하므로 닫은 뒤 다시 자동으로 열리지 않는다.
3. **말풍선**: 피드에 포커스가 있을 때 450ms 뒤에 뜨므로 위 두 화면을 닫은 뒤에 보인다.

## 키 정리

키를 쓰는 feature의 repository가 지운다. `bootstrap/startup/startup-key-cleanup.ts`가 앱 시작 때 한 번 부르고, 실패해도 앱을 막지 않고 Logger에 남긴다.

| 대상                                         | 정리                                                           |
| -------------------------------------------- | -------------------------------------------------------------- |
| `RELEASES`에 없는 캠페인의 본 기록·재진입 키 | 앱 시작 때                                                     |
| 14일 지난 재진입 키                          | 앱 시작 때                                                     |
| `RETIRED_COACHMARK_KINDS`의 말풍선 키        | 앱 시작 때. 이미 본 사람에게 다시 뜰 일이 없어진 뒤에만 올린다 |
| 그 계정의 안내 키                            | 탈퇴 때. 로그아웃은 같은 사람이 돌아오므로 남긴다              |

`aido_activation_v1`, 위젯, SecureStore 키는 지우지 않는다.

## 화면 확인

폴드 접힘·펼침, 글꼴 5단계에서 CTA 닿음, 다크, 움직임 줄이기, Android 뒤로 가기, iOS 스와이프 뒤로 가기, 연타, 오프라인, ko·en을 기기에서 본다.
