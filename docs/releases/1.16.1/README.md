# 1.16.1: 의존성 정리

**상태: 준비 중.** 지금까지는 도구·서버·앱 의존성 갱신만 담았다. 다른 층이 더해지면 요약과 스토어 문구를 함께 고친다. CI·머지·서버 운영 배포·스토어 제출·실기기 확인은 아직이다. 측정하지 않은 값은 적지 않는다.

| 내용        | 문서                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| 호환 규칙   | [호환](../../conventions/compatibility.md)                                                                                 |
| 배포·롤백   | [서버 배포와 롤백](../../../apps/api/docs/deployment.md), [앱 빌드와 출시](../../../apps/mobile/docs/build-and-release.md) |
| 스토어 문구 | [release.json](../../../apps/mobile/store-metadata/1.16.1/release.json)                                                    |
| 이전 버전   | [1.16.0](../1.16.0/README.md)                                                                                              |

## 요약

- **도구**: pnpm 12.21.0, Turborepo 2.11.13, Vitest 5.1.1, knip 6.48.0, dependency-cruiser 18.9.0. 쓰지 않는 pnpm override와 철회된 picomatch audit 예외를 지웠다. Dependabot은 `@tanstack/*`·`@react-native-firebase/*`·`turbo`+`@turbo/*`를 한 PR로 묶고 `docker-compose.yml` 이미지도 본다.
- **서버 이미지·로컬 환경**: 베이스 이미지를 digest로 고정했다. 로컬·테스트 PostgreSQL 16.16, 캐시 시험용 Valkey 9.2.0. 운영 DB 주소 예시는 `sslmode=verify-full`이다.
- **서버**: NestJS 12.6.0, `@sentry/nestjs` 11.16.0, AI SDK 7.0.179, Drizzle 1.0.0-rc.6(스냅샷 형식 10, 마이그레이션 SQL 변화 없음). pg-boss는 12.38.2에 둔다(12.39.0의 스키마 47에서 12.38.2가 시작하지 못해 롤백이 막힌다).
- **앱 JS**: TanStack Query 5.108.3(세 패키지 함께), i18next 27.2.4, react-i18next 18.0.3, `@hookform/resolvers` 7.0.8, tailwind-merge 3.7.1, uniwind 1.14.0. Expo fingerprint가 바뀌지 않아 EAS Update로도 낼 수 있다.
- **앱 네이티브**: Expo 58.0.26과 SDK 58 권장 버전(`npx expo install --check` 기준), `@sentry/react-native` 8.28.1(새 인증서로 서명한 Cocoa SDK), `react-native-purchases` 11.0.4, `@react-native-firebase/app`·`analytics` 26.4.2. 스토어 빌드가 필요하다.
- **버전**: 앱 1.16.1. 빌드 번호(EAS remote)와 서버·`@aido/api` 버전은 그대로다.

## 미룬 것

- heroui-native 1.1.1: `BottomSheet`가 네이티브 모듈 `@lodev09/react-native-true-sheet`로 바뀌고 API가 달라진다. 앱의 시트·토스트를 옮기는 작업과 함께 낸다.
- `@react-native-firebase/*` 27, TypeScript 7: Dependabot ignore에 적은 제약이 그대로다.
