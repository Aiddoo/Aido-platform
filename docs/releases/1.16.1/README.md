# 1.16.1: 의존성·레거시 정리와 네이티브 시트

**상태: 출시.** 2026-11-23 `stack/1.16.1/01-tooling-deps`~`18-docs`를 맨 위 PR #1821로 `main`에 머지했고(merge commit `fd62578`), 같은 날 서버를 운영에 배포했다(`deploy.yml` 성공). 같은 날 운영 1.16.0 앱(iOS·Android)에 1.16.1 JS를 OTA로 냈다. 앱은 iOS 1.16.1(165)·Android 1.16.1(versionCode 132)로 두 스토어에 출시했다. 2026-11-24 운영 `AppRelease`(`GET /v1/app-config/app-version`)를 iOS·Android 모두 1.16.1로 올렸고, 전체 사용자에게 언어별(ko·en) 업데이트 알림을 보냈다(`POST /v1/admin/notifications/targeted`, 링크는 언어별 패치노트). 랜딩 [패치 노트](https://aido.kr/ko/patch-notes)는 Aido-Landing #80으로 올렸다. 목표와 완료 조건은 [Epic #1784](https://github.com/Aiddoo/Aido-platform/issues/1784)에 있다. 측정하지 않은 값은 적지 않는다.

| 내용        | 문서                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| 호환 규칙   | [호환](../../conventions/compatibility.md)                                                                                 |
| 배포·롤백   | [서버 배포와 롤백](../../../apps/api/docs/deployment.md), [앱 빌드와 출시](../../../apps/mobile/docs/build-and-release.md) |
| 스토어 문구 | [release.json](../../../apps/mobile/store-metadata/1.16.1/release.json)                                                    |
| 남은 일     | [다음 버전 후보 이슈(#1785)](https://github.com/Aiddoo/Aido-platform/issues/1785)                                          |
| 이전 버전   | [1.16.0](../1.16.0/README.md)                                                                                              |

## 사용자에게 보이는 수정

- iPad·Mac에서 친구 찾기를 열면 앱이 죽던 문제(`AIDO-MOBILE-PRODUCTION-1C`, UISearchController 포커스)를 고쳤다. iPad·Mac은 헤더 검색창 대신 목록 위 JS 입력칸을 쓰고, iPhone·Android는 `Stack.SearchBar` 그대로다(`08-mobile-ipad-search`).
- 모든 시트가 heroui-native 1.1.1 `BottomSheet`(TrueSheet)로 iOS·Android 네이티브 시트로 뜬다. 끌기·딤·키보드·뒤로 가기를 네이티브가 맡는다(`17-mobile-heroui-true-sheet`).
- 홈 화면 위젯 요약이 자정 뒤 지난 날짜로 서버에 묻지 않는다. 요청 순간 기기 시계·시간대로 오늘·내일일 때만 `GET /v1/todos/summary`를 부르고 아니면 이전 데이터를 둔다(운영 로그의 400 `SYS_0002`).
- AI 리포트의 "모두 끝낸 날"과 "주로 끝낸 시간"을 서버 값(`stats.perfectDays`·`peakHour`)으로 그린다. 모두 끝낸 날은 연속 기록·달력과 같은 `isAllCompleted` 규칙이고, 주로 끝낸 시간은 같은 수면 이른 시간이다. 1.16.0 전 리포트는 지금처럼 그 칸을 숨긴다.
- 할 일 상세·동작 시트의 콕 감사 줄은 서버 판정 `permissions.canThank`로 보인다. 규칙은 감사 보내기와 같고 완료·공개 범위를 바꾸면 상세를 다시 받아 줄이 바뀐다.
- 결제 화면 로딩 모양을 서버 권한 등급으로 고른다(본문과 같은 기준).
- RevenueCat·Firebase·Sentry·Expo SDK 58 패치 버전을 올렸다.

## 엔지니어링 변경

- **도구**: pnpm 12.21.0, Turborepo 2.11.13, Vitest 5.1.1, knip 6.48.0, dependency-cruiser 18.9.0. 쓰지 않는 pnpm override와 철회된 picomatch audit 예외를 지웠다. Dependabot은 `@tanstack/*`·`@react-native-firebase/*`·`turbo`+`@turbo/*`를 한 PR로 묶고 `docker-compose.yml` 이미지도 본다.
- **서버 이미지·로컬 환경**: 베이스 이미지를 digest로 고정했다. 로컬·테스트 PostgreSQL 16.16, 캐시 시험용 Valkey 9.2.0. 운영 DB 주소 예시는 `sslmode=verify-full`이다.
- **서버 의존성**: NestJS 12.6.0, `@sentry/nestjs` 11.16.0, AI SDK 7.0.179, Drizzle 1.0.0-rc.6(스냅샷 형식 10, 마이그레이션 SQL 변화 없음). pg-boss는 12.38.2에 둔다(12.39.0의 스키마 47에서 12.38.2가 시작하지 못해 롤백이 막힌다).
- **서버 구조**: 모든 slice를 문서의 DDD 모양(자기 id VO, 조회 UseCase, `find*`는 하나 또는 `null`·`list*`는 묶음)으로 맞추고 아키텍처 테스트로 막았다. 배포가 끝난 큐 payload 옛 모양·문자열 DLQ 정의·벽시계/순간 대체 계산을 지웠다. UseCase spec과 그 fixture·double은 손으로 쓴 double과 `FixedClock`만 쓴다(`aido/no-vitest-mock`).
- **판단 주인**: 앱이 다시 계산하던 `canThankTodo`·`hasPremiumAccess`·리포트 완벽한 날·주로 끝낸 시간을 서버 값으로 바꿨다([서버·앱 책임](../../conventions/ownership.md)).
- **문법**: 서버·앱·도구에 `replaceAll`·`for…of`·ts-pattern `exhaustive`·es-toolkit 정렬 같은 최신 문법을 lint로 고정했다. 앱은 Hermes가 지원하는 API만 쓴다. RNTL 14 `fireEvent`·`render`는 Promise를 기다린다.
- **앱 JS**: TanStack Query 5.108.3(세 패키지 함께), i18next 27.2.4, react-i18next 18.0.3, `@hookform/resolvers` 7.0.8, tailwind-merge 3.7.1, uniwind 1.14.0.
- **앱 네이티브**: Expo 58.0.26과 SDK 58 권장 버전(`npx expo install --check` 기준), `@sentry/react-native` 8.28.1(새 인증서로 서명한 Cocoa SDK), `react-native-purchases` 11.0.4, `@react-native-firebase/app`·`analytics` 26.4.2. 시트는 heroui-native 1.1.1과 `@lodev09/react-native-true-sheet` 4.1.2(설정 플러그인 없음)이고 `@gorhom/bottom-sheet`와 패치, `expo-linear-gradient`(ScrollShadow 기본 그라디언트로 대체)를 지웠다. fingerprint가 바뀌어 스토어 빌드가 필요하다.
- **Android 권한**: `expo-network`가 더하는 `ACCESS_WIFI_STATE`를 `blockedPermissions`로 뺐다. 앱은 온라인 여부를 `ConnectivityManager`로만 읽고, Play는 이 권한을 `android.hardware.wifi` 필수 기능으로 보아 Wi-Fi 없는 기기에서 설치를 막는다.
- **문서**: 같은 규칙을 주인 문서 한 곳에 두고 나머지는 링크한다. 아직 목표 모양이 아닌 코드는 [#1785](https://github.com/Aiddoo/Aido-platform/issues/1785)가 가리킨다.
- **버전**: 앱 1.16.1. 빌드 번호(EAS remote)와 서버·`@aido/api` 버전은 그대로다.

## 서버 변경과 호환

[호환](../../conventions/compatibility.md) 규칙대로 응답 모양은 추가만 한다. 출시 앱(1.16.0 이하)은 새 칸을 버린다. DB 마이그레이션은 없다.

| 변경                                               | 출시 앱 | 1.16.1 앱                |
| -------------------------------------------------- | ------- | ------------------------ |
| 할 일 상세 `permissions.canThank`                  | 버린다  | 콕 감사 줄               |
| AI 리포트 `stats.perfectDays`·`peakHour`(nullable) | 버린다  | 모두 끝낸 날·시간대 차트 |

`@aido/api`는 서버가 늘 보내는 세 칸을 필수로 둔다. 이 stack의 앱 코드(OTA와 1.16.1)는 대체 값 없이 읽으므로 OTA를 낸 뒤에는 서버를 이 stack의 머지 커밋보다 앞 SHA(`fab036b31` 등)로 되돌리지 않는다. 서버 롤백은 OTA 전까지만 이전 SHA 재배포로 한다.

## 배포 순서

1. 서버를 먼저 배포한다(Blue-Green, [서버 배포와 롤백](../../../apps/api/docs/deployment.md)). 배포 뒤 `/health`, 로그 error, pg-boss 큐 처리, refresh 토큰 수명을 확인한다.
2. 서버가 안정되면 OTA를 낸다. 머지된 `main`에는 네이티브 층(Expo 패치·TrueSheet)이 있어 fingerprint가 운영 1.16.0과 다르므로, OTA는 마지막 JS 층 커밋(`stack/1.16.1/15-mobile-modern-idioms`, fingerprint가 운영과 같음)의 독립 clone에서 낸다. OTA 뒤에는 서버를 이 stack 앞 SHA로 되돌리지 않는다.
3. 앱은 시뮬레이터 QA(iPhone → iPad → 접은 Duo) 뒤 스토어에 제출한다. 모든 시트를 키보드·VoiceOver와 함께 확인한다.
4. 스토어 문구는 `apps/mobile/store-metadata/1.16.1/release.json`과 listing `release_notes.txt`를 같은 순서로 맞추고 `pnpm --filter @aido/mobile store:check`로 확인한다.
5. 스토어에서 받을 수 있게 된 뒤 플랫폼마다 `AppRelease`를 1.16.1로 올린다([서버 배포](../../../apps/api/docs/deployment.md#공개-버전과-env-반영)).

## 미룬 것

- 시트 route를 TrueSheet의 Expo Router `Sheet` 레이아웃으로 옮기는 것: route 구조가 바뀌어 지금의 `transparentModal` route를 그대로 둔다.
- `@react-native-firebase/*` 27, TypeScript 7: Dependabot ignore에 적은 제약이 그대로다.
