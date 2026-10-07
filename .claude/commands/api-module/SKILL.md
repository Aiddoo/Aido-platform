---
name: api-module
description: 서버 기능을 추가하거나 Context·slice를 분리할 때 현행 DDD 모듈 구조로 구현한다.
disable-model-invocation: true
---

# 서버 모듈 추가·분리

`$ARGUMENTS`의 기능을 기존 REST 계약과 Context 경계에 맞게 구현한다. 이름만으로 새 Context를 만들지 말고 데이터·정책 소유자를 먼저 확인한다.

## 필요한 참조

- [서버 진입점](../../../apps/api/AGENTS.md): 공통 경계와 완료 기준.
- [구조](../../../apps/api/.claude/architecture.md): Context·slice·조립·공개 capability를 정할 때.
- [코드 규칙](../../../apps/api/.claude/api-conventions.md): 파일 이름과 구현 예제가 필요할 때.
- [REST 계약](../../../apps/api/.claude/rest-contracts.md): route·DTO·응답을 추가하거나 바꿀 때.
- [Prisma](../../../apps/api/.claude/prisma.md): 영속성·트랜잭션·schema를 바꿀 때.
- [테스트](../../../apps/api/.claude/testing-guide.md): 변경 동작을 검증할 때.

## 구현 기준

Context는 `apps/api/src/modules/<context>`, slice는 각 레이어 아래에 둔다. 현재 참조 구현은 `planning`이다.

```text
<context>/
  domain/{aggregates,entities,value-objects,policies}/<slice>/
  application/{use-cases,ports,read-models}/<slice>/
  infrastructure/{persistence,adapters}/<slice>/
  presentation/{controllers,dtos,mappers}/<slice>/
  <context>-<slice>.module.ts
  <context>-<slice>-application.providers.ts
  <context>-<slice>.public.ts
```

위 목록에서 필요한 파일만 만든다. 상태 없는 조회·전달에 가짜 Aggregate나 빈 폴더를 만들지 않는다. Controller가 endpoint UseCase를 호출하고, 순수 Application 클래스는 생성자 객체로 필요한 Port만 받는다. Nest factory provider가 구현체를 조립한다.

HTTP 스키마·오류는 `@aido/api`로 공유한다. Prisma 타입·vendor SDK를 공유 계약이나 Domain/Application에 노출하지 않는다. 데이터 변경의 업무 단위는 `UnitOfWorkPort.run`으로 묶고 repository가 CLS의 활성 transaction을 사용한다. 다른 Context에는 해당 공개 capability로 연결한다.

완료는 실제 사용 흐름과 관련 예외가 구현·검증되고, 기존 앱 계약과 의존성 경계가 유지되며, 변경한 문서가 실제 코드와 일치하는 상태다. 테스트·검증 명령과 결과를 기록하고, 추가 변경이 없으면 통과한 전체 검사를 반복하지 않는다.
