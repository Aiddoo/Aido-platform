# 서버 구조 전환

끝난 전환의 기록이다. Epic [#882](https://github.com/Aiddoo/Aido-platform/issues/882)는 Prisma 8 기반 서버를 지금의 모듈러 모놀리스로 옮겼다. 단계별 Before/After와 측정치는 그때 조건의 값이라 지웠다. 전문은 `git show fc146d7de:docs/server/migration.md`로 읽는다.

## 결과

- 업무는 `src/modules/<context>`, 실행 기술은 `src/platform`, 순수 공통 코드는 `src/shared`에 있다.
- ORM은 Drizzle 1.0 RC, durable job은 pg-boss 하나다. Prisma와 BullMQ는 쓰지 않는다.
- 공유 계약은 `@aido/api`, 서버 패키지는 `@aido/server`다.

## 살아 있는 규칙이 있는 곳

| 규칙                                          | 문서                                              |
| --------------------------------------------- | ------------------------------------------------- |
| 레이어·상태 소유·서버가 판단하는 것           | [구조](../../apps/api/.claude/architecture.md)    |
| 출시 앱 호환, 새 기능은 추가 API로            | [호환](../conventions/compatibility.md)           |
| 실제 DB·HTTP 증거의 범위, fixture 재생성 금지 | [테스트](../../apps/api/.claude/testing-guide.md) |
| 측정한 숫자만 쓴다, 이슈·PR 양식              | [커밋·PR](../conventions/git.md)                  |
| 적용 순서와 롤백                              | [배포](../../apps/api/DEPLOYMENT.md)              |
