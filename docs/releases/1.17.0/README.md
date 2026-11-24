# 1.17.0: 캘린더 가져오기

**상태: 준비 중.** 코드와 문서는 stack으로 올리는 중이고 머지·배포·QA·스토어 제출은 아직 하지 않았다. 아래에서 확인하지 못한 값은 `미확인`으로 적는다. 사용자·트래픽·매출 같은 규모 숫자는 적지 않는다.

| 내용          | 문서                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 호환 규칙     | [호환](../../conventions/compatibility.md)                                                                                 |
| 배포·롤백     | [서버 배포와 롤백](../../../apps/api/docs/deployment.md), [앱 빌드와 출시](../../../apps/mobile/docs/build-and-release.md) |
| 새 기능 소개  | [새 기능 소개 출시](../../../apps/mobile/docs/whats-new-release.md)                                                        |
| 스토어 문구   | [release.json](../../../apps/mobile/store-metadata/1.17.0/release.json), [store-listing](store-listing.md)                 |
| 개인정보 라벨 | [privacy-label](privacy-label.md)                                                                                          |
| 심사 메모     | [app-review-notes.en](app-review-notes.en.md)                                                                              |
| 상황 확인표   | [qa-matrix](qa-matrix.md)                                                                                                  |
| 이전 버전     | [1.16.1](../1.16.1/README.md)                                                                                              |

## 무엇을, 왜

기기 캘린더에 이미 있는 일정을 할 일로 한 번에 옮기고 싶다는 필요에서 시작했다. 마이 > 설정 > 캘린더 가져오기에서 기기에 동기화된 캘린더(iCloud·Google·Outlook 등)를 `expo-calendar`로 읽기만 하고(쓰기·삭제 없음) 고른 일정을 할 일로 만든다. 한 번 가져오는 기능이고 동기화가 아니다.

흐름은 다음과 같다.

1. 안내 화면이 무엇을 읽고 보내는지 알리고 버튼은 `계속` 하나다. 이 버튼을 누른 뒤에만 시스템 권한 창이 뜬다.
2. 캘린더와 기간(시작일·종료일, 바로 고르기 1주·1개월·3개월·6개월·1년)을 고른다. 공휴일·생일·구독 캘린더는 처음에 선택하지 않는다.
3. 캘린더마다 새 카테고리(캘린더 이름·색) 또는 기존 카테고리를 고르거나 `모두 한 카테고리에`를 쓴다.
4. 옵션: `시간도 가져오기`(처음 켬, 끄면 날짜만이고 리마인드 없음), `친구에게 공개`(처음 끔).
5. `가져오기`를 누르면 서버가 백그라운드로 처리한다. 앱을 나가도 되고 네트워크가 끊겨도 이어진다. 끝나면 가져온 수와 건너뛴 이유를 보인다.
6. 7일 안에는 되돌릴 수 있다. 끝내지 않은 가져온 할 일만 지우고 완료한 것은 남긴다. 같은 일정은 두 번 가져오지 않는다.

요금제: 가져오기는 무료이고 범위만 다르다. 무료는 오늘부터 30일 뒤까지, 프리미엄은 365일 뒤까지다. 숫자는 서버 `PLAN_CATALOG`의 `CALENDAR_IMPORT`가 주인이고 앱은 서버 값을 그린다. 카테고리 한도는 그대로다. 구독 화면·업셀에도 이 범위를 적는다.

그 밖: 1.17.0 새 기능 소개(1.15.0 소개를 대체, 1.16.0 소개는 유지), Mac에서 날씨를 열 때마다 위치를 다시 묻던 문제 수정(권한을 기기에 기억). 안쪽 변경은 새 할 일이 많을 때 리마인드를 한 번에 예약하는 것과 429 `Retry-After`를 따르는 것이다.

## stack

`stack/1.17.0/NN-…` 브랜치 순서다(맨 아래가 01).

| #   | 브랜치                                               |
| --- | ---------------------------------------------------- |
| 01  | `01-api-vocabulary-contracts`                        |
| 02  | `02-entitlement-calendar-import`                     |
| 03  | `03-server-todo-batch-write`                         |
| 04  | `04-server-todo-imports-slice`                       |
| 05  | `05-server-todo-import-jobs`                         |
| 06  | `06-mobile-calendar-source`                          |
| 07  | `07-mobile-todo-import-domain`                       |
| 08  | `08-mobile-todo-import-screens`                      |
| 09  | `09-mobile-weather-mac-location`                     |
| 10  | `10-mobile-whats-new-1-17-0`                         |
| 11  | `11-mobile-version-1-17-0`                           |
| 12  | `12-docs-release-1-17-0`(이 문서, 앱 버전 1.17.0 위) |

## 호환

[호환](../../conventions/compatibility.md) 규칙대로 출시 앱(1.16.x 이하)이 보는 계약은 추가만 한다. 출시 앱은 새 라우트를 부르지 않고 권한 응답의 새 값은 무시한다. 가져온 할 일은 출시 앱에서 평범한 할 일로 보인다. DB 마이그레이션은 `04-server-todo-imports-slice`에 있다.

## 배포 순서

1. 서버 stack(01~05)을 함께 머지하고 서버를 배포한다(Blue-Green, [서버 배포와 롤백](../../../apps/api/docs/deployment.md)).
2. `/health`, pg-boss 큐 처리, 로그 error를 확인한다.
3. 시뮬레이터 QA를 iPhone → iPad → 접은 Duo 순서로 한다. 캘린더에 일정을 미리 넣어 둔다. 결과는 [qa-matrix](qa-matrix.md)에 확인한 값만 적는다.
4. 스토어에 제출한다. `expo-calendar`가 네이티브 모듈이라 fingerprint가 바뀌어 OTA로 낼 수 없고 스토어 빌드가 필요하다. 문구는 `store:check`로 확인한다.
5. 스토어에서 받을 수 있게 된 뒤 플랫폼마다 `AppRelease`를 1.17.0으로 올리고 운영 env를 맞춘다: `FEATURE_DISCOVERY_CAMPAIGN_ID=feature-discovery-1.17.0`, `FEATURE_DISCOVERY_MIN_APP_VERSION=1.17.0`([새 기능 소개 출시](../../../apps/mobile/docs/whats-new-release.md)). 서버를 먼저 배포한다.

## 확인하지 못한 것

- 서버 stack 머지·운영 배포, 시뮬레이터·실기기 QA, 서명된 빌드의 Info.plist·AndroidManifest 권한 값, 콘솔 신고(App Privacy·Data safety) 입력: 모두 미확인.
- 개인정보 처리방침은 aido.kr에 머지되어 있고 시행일은 2026-12-01이다. 시행 전에 앱이 나가지 않도록 제출 날짜를 맞춘다.
