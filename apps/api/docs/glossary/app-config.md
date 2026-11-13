# app-config 용어집

앱 버전·기능 소개 설정을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

운영자가 env로 정하고 서버는 읽기만 한다. 두 Aggregate 모두 상태 전이가 없고 env → Aggregate 복원은 `*-env.mapper.ts`가 한다.

| 용어             | 코드                                                                | 뜻                                                                                               |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 앱 릴리스        | `AppRelease`(Aggregate), `AppReleaseId`                             | 스토어에 공개된 플랫폼별 최신 앱. 플랫폼(`ios`·`android`)이 식별자다                             |
| 앱 버전          | `AppVersion`(VO, `app-config/shared/domain`)                        | 시작할 때 SemVer로 검증한 버전 문자열                                                            |
| 최신 릴리스 조회 | `ListAppReleasesUseCase`, `listLatestReleases`                      | 확인을 껐거나 한 플랫폼이라도 버전이 없으면 빈 목록이고 응답은 `enabled: false`다(안전하게 닫음) |
| 기능 소개 캠페인 | `FeatureDiscoveryCampaign`(Aggregate), `FeatureDiscoveryCampaignId` | 운영 kill switch로 켠 기능 소개. 식별자는 앱에 번들된 문구 key다                                 |
| 최소 앱 버전     | `minAppVersion`                                                     | 이 버전 이상 앱만 소개를 보인다(판단은 앱이 한다)                                                |
| 진행 중 캠페인   | `GetFeatureDiscoveryCampaignUseCase`, `findActiveCampaign`          | 꺼져 있거나 필수 설정이 빠졌거나 출시 시각을 읽을 수 없으면 `null`이다                           |
