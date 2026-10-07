# 서버 검증과 Actions

Prisma 8 기준점은 `823724b5`, Epic은 [#882](https://github.com/Aiddoo/Aido-platform/issues/882)다.
기존 앱 계약은 고정된 배포 fixture와 OpenAPI operation fingerprint로 검증한다.

## 실행 범위

중간 Stack PR은 Draft로 유지한다. `stack:server-architecture`와 기존 release Stack은
`ci:stack-tip`을 가진 Ready tip에서 develop 대비 누적 변경을 검증한다. 부모·trunk의 현재
SHA가 tip에 포함되지 않거나 Stack이 끊어지면 검증을 거부한다. 문서 변경은 무거운 runner를
생략하고, 공유 계약 변경은 API와 Mobile을 모두 검증한다. 문서만 변경하면 설치·lint runner도
생략한다. 불명확한 변경 범위는 전체 검사다.

API Unit/coverage·Integration·E2E·build는 `Verify API` runner에서 한 번 설치한 의존성을
사용한다. Unit/coverage를 중복 실행하지 않는다. Mobile과 공유 계약의 Unit은 별도 runner다.
DB Integration·E2E는 Turbo 결과를 캐시하지 않는다. 새 커밋은 GitHub concurrency로 이전
검증을 취소한다. 이미지 발행은 main의 필수 검증 성공 후에만 가능하다.

## 공식 기능과 프로젝트 코드의 경계

- [setup-node](https://github.com/actions/setup-node): Node 설치와 pnpm store cache.
- [github-script](https://github.com/actions/github-script): 인증된 Octokit과 pagination.
- [PostgreSQL service](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers): 시작·health check·종료.
- upload-artifact: 실패 로그 보존. 로그 pipefail은 GitHub bash 실행 환경에서 처리한다.
- 기존 `stack-policy.mjs`와 `dependency-scope.mjs`: Aido의 Stack 연결과 영향 범위 정책만 소유한다.

API wrapper·tee wrapper·컨테이너 wrapper 스크립트는 추가하지 않는다. migration guard,
배포 lock·health·rollback처럼 실제 안전 책임을 가진 기존 실행 경로는 유지한다.

## 테스트 DB

CI는 명시적인 `AIDO_TEST_POSTGRES_URL`을 postgres administration DB에 연결한다. 각 Vitest
project는 무작위 `aido_test_<run-id>` DB를 생성·마이그레이션하고 자신의 DB만 종료·삭제한다.
`DATABASE_URL`을 administration URL로 재사용하지 않는다. 로컬에서는 해당 변수를 생략하면
기존 Testcontainers 수명주기를 사용한다. 잘못된 생성 이름·업무 DB service URL을 거부하고
시작·migration 실패 시 resource와 환경을 정리한다.

## 측정

기준점 재검증(2026-10-07): Unit 446파일/2,895테스트, 실제 PG Integration 43파일/433테스트,
HTTP E2E 34파일/480테스트 통과. lint·format·typecheck·monorepo build·actionlint도 통과했다.

전환 레이어 검증: 전체 Unit 447파일/2,902테스트, DB lifecycle Unit 13테스트,
PostgreSQL service 연결 Integration 3파일/10테스트, 고정 계약 E2E 3파일/11테스트 통과.
Workspace 의존성 검사도 포함한다. 타입 검사는 API를 캐시 없이 실행해 확인했다.

이 변경은 workflow의 중복 설치·DB container 시작을 줄인다. API만 영향받는 실행의
설치 위치는 정의상 5개에서 2개, API와 Mobile 실행은 5개에서 3개로 줄었다. 실제 billed time과 비용
절감률은 아직 미측정이다. 수동 performance project를 일반 PR CI에 포함하지 않는다.
