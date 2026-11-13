# 테스트 파일 이름과 형식

서버·모바일 공통 기준이다. 접미사는 앱마다 프레임워크 관례를 따른다. 범위(무엇을 테스트하나)는 앱 문서가 정한다.

## 1. 파일 이름

| 앱·종류                | 위치                                    | 이름                    | 러너      |
| ---------------------- | --------------------------------------- | ----------------------- | --------- |
| 서버 단위              | 대상 옆                                 | `*.spec.ts`             | Vitest    |
| 서버 통합(DB 등)       | `apps/api/test/integration/`            | `*.integration-spec.ts` | Vitest    |
| 서버 E2E               | `apps/api/test/e2e/`                    | `*.e2e-spec.ts`         | Vitest    |
| 모바일 단위·통합       | 대상 옆(JSX가 없으면 `.ts`)             | `*.test.ts(x)`          | jest-expo |
| 모바일 흐름(여러 모듈) | 대상 옆                                 | `*.flow.test.tsx`       | jest-expo |
| 모바일 Android 전용    | 대상 옆                                 | `*.android.test.ts(x)`  | jest-expo |
| 모바일 E2E             | `apps/mobile/.maestro/flows/{feature}/` | `*.yaml`                | Maestro   |

- 원본 파일 하나에 테스트 파일 하나다.
- 서버 `*.spec.ts` 러너의 세부와 시간·flake 규칙은 [서버 테스트](../../apps/api/docs/testing.md)를 따른다.
- 모바일 route 화면 테스트 자리(`app/` 밖), 도구(`createTestDi`·`renderScreen` 등), fixture, 금지 목록은 [모바일 테스트](../../apps/mobile/docs/testing.md)를 따른다.

## 2. 형식

- 제목은 한국어 시나리오다. 맨 위 `describe`는 대상의 코드 이름이다.
- 본문은 `// Given`·`// When`·`// Then` 한 줄 주석으로 나눈다. 준비가 없으면 `// Given`은 생략한다. 합본(`// When / Then`)과 꼬리 설명을 쓰지 않는다.
- 같은 입력 표는 `it.each`다.
- 결과는 상태(저장값, 캐시, 화면)로 단언한다. 호출 확인은 HTTP·분석·햅틱·네이티브 같은 가장 바깥 경계에서만 한다.
- mock보다 포트 stub을 넣는다. 외부 API는 부르지 않는다.
- 테스트는 중요한 비즈니스 로직과 공용 유틸에만 쓴다. 기존 테스트를 일괄 교체하지 않는다.
