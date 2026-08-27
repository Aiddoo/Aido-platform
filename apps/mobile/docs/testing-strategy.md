# 모바일 테스트 전략

모바일 자동 테스트는 제품 규칙과 계약 경계에 집중한다. 상세 작성 규칙과 명령은
[`.claude/testing-guide.md`](../.claude/testing-guide.md)가 단일 원본이다.

## 자동 테스트 범위

우선순위는 다음과 같다.

1. Model / Policy의 제품 규칙
2. Service / Mapper의 HTTP·Zod·Domain 변환 경계
3. 자체 분기와 경계값이 있는 pure util / view-model

컴포넌트 렌더, hook/Provider, Query Options 배선은 기본 테스트 범위가 아니다. UI 계산은 순수 함수로
분리해 검증하고, 실제 화면 동작은 native QA에서 확인한다. 기존 테스트가 있다는 이유로 같은 종류의
테스트를 계속 추가하지 않는다.

## Native QA 범위

- iOS와 Android 키보드, 뒤로가기, 스크롤 위치
- 작은 화면과 큰 글꼴에서의 줄바꿈과 touch target
- light/dark, VoiceOver/TalkBack, Reduce Motion
- 긴 목록의 blank frame, layout shift, 메모리와 Release frame time

시뮬레이터는 기능과 레이아웃 확인에 사용하고, 60/120 FPS 평가는 Release 실기기에서 수행한다.

## 기본 명령

```bash
pnpm --filter @aido/mobile test --runInBand
pnpm --filter @aido/mobile lint
pnpm --filter @aido/mobile format:check
pnpm --filter @aido/mobile typecheck
pnpm --filter @aido/mobile check:conventions
pnpm --filter @aido/mobile test:conventions
```
