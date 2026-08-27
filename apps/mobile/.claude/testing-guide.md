# Mobile Testing Guide

> 모바일 테스트는 제품 규칙과 계약 경계를 작게 검증한다. React Native 프레임워크 배선이나 화면
> 모양을 테스트 코드로 복제하지 않는다.

## 기본 원칙

새 테스트는 다음 세 범위에 집중한다.

1. **Model / Policy** — 상태 판정, 권한, 입력 정규화처럼 제품 규칙이 있는 순수 로직
2. **Service / Mapper** — HTTP 요청, 공유 Zod 계약 검증, DTO→Domain 변환, 오류 전달
3. **Pure util / view-model** — 여러 분기나 경계값이 있는 순수 계산과 캐시 구조 변환

테스트 개수나 커버리지 수치를 목표로 삼지 않는다. 구현을 그대로 다시 쓰는 테스트보다, 잘못되면
사용자 결과가 달라지는 규칙 하나를 명확히 잠그는 테스트가 낫다.

## 기본적으로 만들지 않는 테스트

다음 테스트는 새 기능의 기본 산출물이 아니다.

- 컴포넌트 렌더, snapshot, className 또는 prop 전달 확인
- hook, Provider, Query Options의 호출 순서와 라이브러리 wiring
- Router, Keyboard, FlashList, 애니메이션 라이브러리 동작을 mock으로 재현하는 테스트
- 번역 문자열 존재 여부, 아이콘 이름, 고정 레이블처럼 정적 검사로 확인 가능한 내용
- getter, 상수, 한 줄 위임 함수처럼 실패 가능성이 없는 구현
- 같은 시나리오를 여러 레이어에서 반복하는 테스트

UI에서 복잡한 계산이 필요하면 계산을 순수 util 또는 view-model로 분리하고 그 함수만 테스트한다.
키보드, 스크롤, 레이아웃 시프트, 큰 글꼴, light/dark, 접근성, frame 성능은 실제 native 화면에서
확인한다.

예외적으로 컴포넌트나 hook 회귀 테스트가 필요하다면 아래 조건을 모두 만족해야 한다.

- 실제 장애나 재현 가능한 회귀를 막는 구체적인 이유가 있다.
- 순수 함수로 책임을 분리해 검증할 수 없다.
- 라이브러리 구현을 과도하게 mock하지 않는 최소 범위다.
- 작업 요청에서 해당 테스트가 명시되었거나 리뷰어와 범위를 합의했다.

`todo-comment` feature는 실제 native QA 행렬과 전용 컨벤션 가드를 사용하므로 이 예외를 적용하지
않는다. 해당 feature의 자동 테스트는 model, service/mapper, pure util/view-model에만 둔다.

기존 테스트가 있다는 이유만으로 새 테스트를 같은 방식으로 추가하지 않는다. 무관한 작업에서 기존
테스트를 일괄 삭제하지도 않는다.

## 파일 위치

| 대상                 | 권장 위치와 이름                                      |
| -------------------- | ----------------------------------------------------- |
| Model / Policy       | `models/{feature}.model.test.ts`                      |
| Mapper               | `services/{feature}.mapper.test.ts`                   |
| Service              | `services/{feature}.service.test.ts`                  |
| Feature pure util    | `presentations/utils/{name}.test.ts`                  |
| 순수 UI 데이터 변환  | `presentations/view-models/{name}.view-model.test.ts` |
| Shared pure util     | `shared/utils/{name}.test.ts`                         |
| 테스트 데이터 팩토리 | `features/{feature}/__tests__/{feature}.factories.ts` |

테스트 파일은 구현 파일 옆에 둔다. `.test.ts`를 기본으로 사용하고, JSX가 꼭 필요한 예외에만
`.test.tsx`를 사용한다. feature 내부 테스트 값을 다른 파일에서 다시 export하지 않는다.

## 무엇을 검증하는가

### Model / Policy

- 상태 조합에 따른 허용/거부 결과
- 입력 정규화와 경계값
- 서버 응답에서 파생되는 제품 의미
- 날짜나 수치 경계처럼 회귀 가능성이 높은 규칙

단순 타입 별칭이나 Zod 계약 자체를 모바일에서 다시 시험하지 않는다. 모바일 고유 policy가 공유
계약 위에 있을 때만 그 결과를 검증한다.

### Mapper / Service

- 올바른 method, path, query, body를 전송하는지
- `@aido/validators` 스키마로 응답을 검증하는지
- ISO 문자열을 `Date` 등 Domain 값으로 한 번만 변환하는지
- `AbortSignal` 같은 호출 제어 값을 transport까지 전달하는지
- 계약 파싱 실패와 서버 오류를 정해진 방식으로 전달하는지

Service 테스트는 HTTP 포트만 mock한다. QueryClient, Router, 화면 컴포넌트를 함께 mount하지 않는다.

### Pure util / view-model

- 경계값과 분기별 입력→출력
- 원본 객체 identity를 보존해야 하는 캐시 변환
- 정렬, 중복 제거, 페이지 평탄화, 레이아웃 위치 계산
- 멱등 key 재사용이나 같은 frame 중복 실행 차단 같은 상태 기계

React hook을 호출하지 않고 함수 입력과 출력만 검증할 수 있어야 한다. React 생명주기가 꼭 필요하면
우선 책임 분리가 덜 된 것은 아닌지 살핀다.

## 작성 규칙

- 테스트 이름은 사용자 또는 제품 결과를 설명한다.
- `Given / When / Then` 주석은 긴 테스트에서만 사용한다.
- 의미 있는 성공·실패·경계 분기만 남긴다. 모든 줄을 실행하기 위한 케이스는 만들지 않는다.
- `jest.fn()`은 네트워크, 저장소, 시간, UUID처럼 실제 경계에만 둔다.
- 하나의 테스트에서 여러 프레임워크 mock을 조립하기 시작하면 순수 로직 추출을 먼저 검토한다.
- 실제 타이머를 기다리지 말고 시간 값을 인자로 주거나 fake timer를 사용한다.
- 테스트끼리 QueryClient, mock, 전역 상태를 공유하지 않는다.

## UI와 native 검증

자동 단위 테스트가 대신할 수 없는 항목은 실제 앱에서 확인한다.

| 영역    | 확인 항목                                                             |
| ------- | --------------------------------------------------------------------- |
| 키보드  | 첫 focus, 닫기/재열기, 마지막 항목 가림, interactive dismiss          |
| 목록    | 첫 frame 위치, prepend 유지, 빈 frame·skeleton flash·layout shift     |
| 접근성  | VoiceOver/TalkBack, focus 순서, 동작 이름, Reduce Motion              |
| 큰 글꼴 | 긴 한글·무공백 영문, multiline 입력, 44pt touch target                |
| 테마    | light/dark semantic color와 대비                                      |
| 성능    | Release 실기기의 JS/UI frame time, keyboard animation, 긴 목록 메모리 |

시뮬레이터 영상은 동작과 레이아웃 증거로 사용할 수 있지만 실제 60/120 FPS를 증명하지는 않는다.
성능 수치는 Release 실기기에서 측정한다.

## 실행 명령

```bash
# 모바일 전체 단위 테스트
pnpm --filter @aido/mobile test --runInBand

# 특정 model/service/util
pnpm --filter @aido/mobile test --runInBand todo-comment.service.test.ts

# 열린 handle 확인이 필요한 순수 테스트 묶음
pnpm --filter @aido/mobile test --runInBand --detectOpenHandles \
  src/features/todo-comment/models \
  src/features/todo-comment/services \
  src/features/todo-comment/presentations/utils \
  src/features/todo-comment/presentations/view-models

# 정적 검증
pnpm --filter @aido/mobile lint
pnpm --filter @aido/mobile format:check
pnpm --filter @aido/mobile typecheck
pnpm --filter @aido/mobile check:conventions
pnpm --filter @aido/mobile test:conventions
```

작업을 마칠 때는 변경한 Model/Service/util 테스트와 정적 검증을 먼저 실행한다. 전체 모바일 테스트는
공유 코드나 공통 설정을 바꿨거나 릴리스 전 회귀 확인이 필요할 때 실행한다.
