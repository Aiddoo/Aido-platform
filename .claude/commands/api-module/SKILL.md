---
name: api-module
description: 서버 기능을 추가하거나 Context·slice를 분리할 때 현행 DDD 모듈 구조로 구현한다.
disable-model-invocation: true
---

# 서버 모듈 추가·분리

`$ARGUMENTS`의 기능을 기존 REST 계약과 Context 경계에 맞게 구현한다. 이름만으로 새 Context를 만들지 말고 데이터·정책 소유자를 먼저 확인한다.

## 필요한 참조

- [서버 진입점](../../../apps/api/AGENTS.md): 공통 경계와 완료 기준.
- [구조](../../../apps/api/docs/architecture.md): Context·slice·조립·공개 capability를 정할 때.
- [이름 사전](../../../apps/api/docs/conventions.md)·[도메인 모델](../../../apps/api/docs/domain-modeling.md): 파일 이름과 모델 규약이 필요할 때.
- [HTTP 계약](../../../apps/api/docs/http-contracts.md): route·DTO·응답을 추가하거나 바꿀 때.
- [영속성](../../../apps/api/docs/persistence.md): 저장소·트랜잭션·schema를 바꿀 때.
- [테스트](../../../apps/api/docs/testing.md): 변경 동작을 검증할 때.

## 구현 기준

새 slice는 `apps/api/src/modules/<context>/<slice>/` 아래에 레이어를 둔다. 기준 구현은 notes/memos다. 생성기(`pnpm gen:api-slice`)가 있으면 그것으로 뼈대를 만든다.

```text
<context>/<slice>/
  <context>-<slice>.module.ts
  <context>-<slice>.providers.ts
  <context>-<slice>.public.ts
  domain/  application/  infrastructure/  presentation/http/v1/
```

필요한 파일만 만들고 빈 폴더를 남기지 않는다. Controller가 UseCase를 호출하고, UseCase는 생성자 객체로 필요한 Port(abstract class)만 받는다. `*.providers.ts`의 `provideUseCase`가 구현체를 조립한다. 아직 옮기지 않은 Context에 기능을 더할 때는 그 Context의 옛 구조를 따르고 섞지 않는다.

HTTP 스키마·오류는 `@aido/api`로 공유한다. ORM 타입·vendor SDK를 공유 계약이나 Domain/Application에 노출하지 않는다. 데이터 변경의 업무 단위는 `UnitOfWorkPort.run`으로 묶고 repository가 CLS의 활성 transaction을 사용한다. 다른 Context에는 해당 공개 capability로 연결한다.

완료는 실제 사용 흐름과 관련 예외가 구현·검증되고, 기존 앱 계약과 의존성 경계가 유지되며, 변경한 문서가 실제 코드와 일치하는 상태다. 테스트·검증 명령과 결과를 기록하고, 추가 변경이 없으면 통과한 전체 검사를 반복하지 않는다.
