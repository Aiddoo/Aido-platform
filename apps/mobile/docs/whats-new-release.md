# 새로운 기능 출시 체크리스트

마이 메뉴 "새로운 기능"의 목록과 출시별 Steps를 더할 때 따른다. 코드는 `features/app-config/whats-new`, 서버 설정 조회는 `features/app-config/feature-campaign`이다.

## 출시마다 할 일

1. `schemas/release.schema.ts`의 `RELEASE_ID`에 한 줄 더한다.
2. `constants/releases.ts`에 `RELEASE_x_y_z`와 `RELEASES` 항목을 더한다. 캠페인 id가 새로 생기면 `feature-campaign.constants.ts`에도 더한다. 활성화가 그 캠페인을 이어야 하면 `ACTIVATION_CAMPAIGN_IDS`에 올린다.
3. `components/release-x-y-z-steps.tsx`를 만들고 `app/(app)/whats-new/index.tsx`의 `match`에 잇는다. id를 더하면 `exhaustive()`가 컴파일 에러로 알려 준다.
4. `app/(app)/whats-new/releases.tsx`에 `<ReleaseRow />` 한 줄을 더한다.
5. `assets/whats-new/{version}/`에 WebP를 넣는다. 파일 이름은 `{step}.{ko|en}.{light|dark}.webp`다. 개인정보 없는 샘플 데이터로 찍는다.
6. `locales/{ko,en}/whats-new.json`에 문구를 넣는다. 제목 1줄(약 14자), 설명 1~2줄(약 40자)이다.
7. `constants/whats-new.events.ts`와 측정 문서를 확인한다. CTA 뒤 실제 사용은 `trackAttributedFeatureSuccess`로 잇는다.
8. 운영 설정 `FEATURE_DISCOVERY_CAMPAIGN_ID`, `MIN_APP_VERSION`, `LAUNCHED_AT`, `AUTO_OPEN`을 바꾼다. 서버를 먼저 배포한다.
9. 최근 2개 출시만 WebP를 번들에 둔다. 지난 출시의 파일을 지우고 Steps는 글과 그림 없는 미디어로 줄인다.

## 동작 규칙

| 규칙                    | 구현                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| 계정·캠페인별 한 번     | `aido_feature_discovery_seen_v1:{userId}:{campaignId}`. 동기 claim                                          |
| 기존 가입자만 자동      | `WhatsNewPolicy.shouldAutoOpen`: `user.createdAt < launchedAt`, 지원 버전, 안 봄, 서버 `enabled`·`autoOpen` |
| 다른 안내와 겹치지 않음 | 날씨 위치 안내 대기, `useStableFeedForeground`                                                              |
| 다시 열기               | 피드 카드 14일(`aido_feature_discovery_reentry_v1:{userId}:{campaignId}`), 마이 메뉴 상시                   |
| 안 본 출시 점           | 최신 출시만 본다. 지난 출시까지 세면 점이 오래 사라지지 않는다                                              |
| 오프라인, 서버 실패     | 목록과 Steps는 번들이라 그대로 열린다. 설정을 못 받으면 자동으로 열지 않는다                                |

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
