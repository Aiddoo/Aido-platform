---
name: api-feature
description: 서버 기능을 추가하거나 Context·slice를 분리할 때 현행 slice 구조로 구현한다.
disable-model-invocation: true
---

# 서버 모듈 추가·분리

`$ARGUMENTS`의 기능을 기존 REST 계약과 Context 경계에 맞게 구현한다. 이름만으로 새 Context를 만들지 말고 데이터·판단 소유자를 먼저 확인한다.

## 순서

[새 기능 추가](../../../apps/api/docs/new-feature.md)를 그대로 따른다. 뼈대는 `pnpm gen:api-slice`로 만들고, 기준 구현은 notes/memos다.

## 필요할 때 읽을 문서

- [서버 진입점](../../../apps/api/AGENTS.md): 서버 규칙 체크리스트와 완료 기준.
- [구조](../../../apps/api/docs/architecture.md): Context·slice·공개 면·조립.
- [이름 사전](../../../apps/api/docs/conventions.md)·[도메인 모델](../../../apps/api/docs/domain-modeling.md): 파일 이름과 모델 규약.
- [HTTP 계약](../../../apps/api/docs/http-contracts.md): route·DTO·응답.
- [영속성](../../../apps/api/docs/persistence.md): 저장소·잠금·schema.
- [테스트](../../../apps/api/docs/testing.md): 변경 동작 검증.

완료는 실제 사용 흐름과 관련 예외가 구현·검증되고, 출시 앱 계약과 의존성 경계가 유지되며, 바꾼 규칙이 문서와 일치하는 상태다. 실행한 검증 명령과 결과를 기록하고, 추가 변경이 없으면 통과한 전체 검사를 반복하지 않는다.
