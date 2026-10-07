# Prisma 8 전환 검증

검증일: 2026-10-06. Node.js 24.21.0, pnpm 10.34.6, PostgreSQL 16,
ARM64 Docker 이미지에서 확인했다. 운영 DB에 적용하거나 이미지를 발행하지 않았다.

## 변경 범위

- ORM `@prisma/orm-postgres@8.0.0-rc.14`, CLI `prisma@8.0.0-rc.20`을 고정했다.
  두 패키지는 독립적으로 릴리스되며 현재 구성은 RC다.
- CRUD·관계 조회·집계를 native ORM으로 전환했다. Date/string/JSON/null 변환은
  인프라 경계에서 처리하고 기존 application port와 HTTP 계약을 유지했다.
- native transaction을 CLS에 연결했다. Required 전파, rollback, after-commit,
  prepared query와 pg-boss enqueue/cancel의 동일 transaction 참여를 검증했다.
- 구 생성 client, adapter, migration source 및 실행 명령을 제거했다.
  Terminus의 사용하지 않는 optional client peer는 설치되지 않도록 차단한다.
  기존 DB의 unmanaged migration 이력은 삭제하지 않는다.
- 리포트는 준비된 ORM 집계로 8쿼리를 5쿼리로 줄였다. 오늘의 할 일 통계는
  두 count 대신 한 groupBy 집계로 처리한다. 기존 ID 커서는 동일한 정렬 키의
  배타적 keyset으로 처리하고 페이지 크기와 관계 projection을 제한한다.
- `null`은 nullable 필드 지우기, `undefined`는 변경 생략으로 유지한다.
  날짜처럼 보이는 JSON 문자열은 변환하지 않는다.

## 자동 검증

| 검증                        | 결과                                                       |
| --------------------------- | ---------------------------------------------------------- |
| API unit + coverage         | 446개 파일, 2,895개 테스트 통과                            |
| 실제 PostgreSQL integration | 43개 파일, 433개 테스트 통과                               |
| HTTP E2E                    | 34개 파일, 480개 테스트 통과                               |
| 기존 공개 계약              | OpenAPI snapshot 및 고정된 구 클라이언트 HTTP fixture 통과 |
| CI 정책                     | 의존성 범위·누적 스택 정책 16개 테스트 통과                |
| GitHub Actions              | actionlint 통과                                            |
| 의존성                      | frozen lockfile / offline install 통과                     |
| 빌드                        | API 및 migration ARM64 Docker 이미지 빌드 통과             |

재현 명령:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm --filter @aido/api test:cov
pnpm --filter @aido/api test:integration
pnpm --filter @aido/api test:e2e
node --test scripts/ci/*.test.mjs
actionlint
docker build --target production -f apps/api/Dockerfile -t aido-api-check .
docker build --target migrate -f apps/api/Dockerfile -t aido-migrate-check .
```

## DB 전환과 실패 검증

격리된 로컬 PostgreSQL에 Docker migration 이미지를 실행했다.

- 빈 DB: baseline의 238 operations, 기존 index를 재사용하는 34 unique constraint
  operations, 시간 codec의 0-operation edge를 적용하고 marker/schema 검증에 성공했다.
  계정 삭제 시 댓글을 보존하는 잠긴 시스템 작성자도 생성된다.
- 기존 schema: 기존 사용자·할 일·분류·밀리초와 timezone 표현, 이력 45건,
  public index 164개의 이름·OID·relfilenode가 전환 전후 동일했다.
- 재실행: 데이터 변경 없이 성공하며 실제 schema와 marker를 다시 검증했다.
- marker 없는 schema drift: 등록에 실패하고 marker를 작성하지 않았다.
- 이미 최신 marker인 schema drift: `db verify`의 column mismatch로 배포를 차단했다.
  native `db migrate`의 no-op 성공만으로 schema 일치를 판단하지 않는다.
- 잘못된 시스템 작성자: 등록 전에 실패했다. 해당 불변식을 만족하는 기존 DB는
  schema 검증 뒤 정상적으로 등록·마이그레이션되었다.
- 활성 writer와 unique 전환: integration에서 index identity 보존과 lock 실패 뒤
  재실행을 확인했다. DDL lock 대기는 5초로 제한하며 schema 변경은 native
  migration transaction에서 처리한다.

## 성능 측정

수동 performance project에서 동일 데이터와 pool을 사용해 기존 8쿼리 구성과
준비된 ORM 5쿼리를 교차 실행했다. 두 방식의 최종 도메인 결과도 비교했다.
아래 수치는 로컬 측정이며 운영 latency의 보장값이 아니다.

| 할 일 수 | 기존 p50 / p95 (ms) | 개선 p50 / p95 (ms) |
| -------- | ------------------- | ------------------- |
| 1,000    | 2.039 / 2.524       | 1.379 / 1.777       |
| 10,000   | 9.155 / 12.270      | 7.589 / 9.562       |
| 100,000  | 84.349 / 95.334     | 71.617 / 79.449     |

측정 프로세스에는 seed와 두 방식의 실행이 함께 있으므로 해당 RSS를 특정
구현의 운영 메모리 사용량으로 해석하지 않는다. `test:performance`는 일반 CI에서
실행하지 않는다.

별도로 production 이미지에서 전체 서버를 시작하고, 외부에서 생성한 10만 건
fixture로 리포트 조회를 15회 실행했다. 실제 서버와 추가 reader pool이 같은
프로세스에 있으며 1 CPU, 512MiB container, 384MiB Node heap 제한을 적용했다.
49,999개 기간 내 할 일과 33,332개 완료 결과가 일치했고 정상 종료했다.
peak RSS는 430.5MiB였다. 이 검증은 동시 요청·장시간 부하 시험을 대체하지 않는다.

## CI와 스크립트

공식 checkout/setup-node/github-script/upload-artifact 및 Docker Actions를 사용한다.
API와 모바일의 의존성 범위, 누적 stack tip, Turbo cache, 별도 이미지 cache를
적용하며 API unit과 coverage의 중복 실행을 없앴다. 문서 변경에는 무거운 서버
검증 runner를 시작하지 않는다.

별도 GitHub API wrapper와 tee wrapper, 전용 shell 테스트를 제거했다.
참조가 없는 이전 일간→월간 사용량 이월 SQL도 제거했다. 현재 월간 정책과 기존
사용량 값은 그대로 유지한다. DB URL guard와 native migration 실행, 서버 배포의
락·health check·rollback, 환경 파일 갱신, 저장소 고유 CI 정책은 필요한 책임이므로
각 전용 파일로 유지한다.

운영 전환 절차와 RC 버전 갱신은 [Prisma 가이드](../.claude/prisma.md)를 따른다.
API와 migration 모두 contract emit 및 graph 검증을 다시 실행한다.
공식 API 근거: [runtime](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/runtime.md),
[queries](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/queries-postgres.md),
[migrations](https://github.com/prisma/orm/blob/v8.0.0-rc.14/skills/prisma-8/references/migrations.md).
