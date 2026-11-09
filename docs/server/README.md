# 서버 문서 안내

서버 작업에 필요한 문서를 고르는 진입점이다. 순서대로 읽을 필요는 없다. 공통 코드 규칙은 [루트 AGENTS](../../AGENTS.md#공통-코드-규칙)에 있다.

## 작업별 참조

| 작업                                 | 문서                                                                                                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 서버 작업의 공통 경계                | [AGENTS](../../apps/api/AGENTS.md)                                                                                                                                                                                    |
| 개발 환경·실행 명령                  | [API README](../../apps/api/README.md)                                                                                                                                                                                |
| Context·레이어·포트·공개 capability  | [Architecture](../../apps/api/.claude/architecture.md)                                                                                                                                                                |
| 파일명·변수명·코드 작성              | [코드 규칙](../../apps/api/.claude/api-conventions.md), [명명](naming.md)                                                                                                                                             |
| 응답·오류, 날짜·시간, 하위 호환, Git | [오류](../conventions/errors.md), [날짜](../conventions/dates.md), [호환](../conventions/compatibility.md), [커밋·PR](../conventions/git.md)                                                                          |
| null·undefined                       | [nullish](../conventions/nullish.md)                                                                                                                                                                                  |
| 공유 Zod·HTTP 응답·출시 앱 계약      | [REST 계약](../../apps/api/.claude/rest-contracts.md)                                                                                                                                                                 |
| ORM·transaction·schema 변경          | [Drizzle](../../apps/api/.claude/drizzle.md)                                                                                                                                                                          |
| 의미 있는 Unit·실제 PG·HTTP 검증     | [테스트 선택](../../apps/api/.claude/testing-guide.md); 필요한 경우 [Unit](../../apps/api/.claude/unit-test.md), [Integration](../../apps/api/.claude/integration-test.md), [E2E](../../apps/api/.claude/e2e-test.md) |
| 로그·민감정보                        | [로깅](../../apps/api/.claude/logging-guide.md)                                                                                                                                                                       |
| AI 프롬프트·업체·비용·eval           | [AI](ai.md)                                                                                                                                                                                                           |
| 푸시 기기·알림·다국어·receipt·queue  | [Push Notifications](../../apps/api/docs/push-notifications.md)                                                                                                                                                       |
| 관리자 알림                          | [Admin Notifications](../../apps/api/docs/admin-notifications.md)                                                                                                                                                     |
| 구독·결제 웹훅                       | [Billing](../../apps/api/docs/billing.md)                                                                                                                                                                             |
| 반복 할 일 규칙                      | [구조의 반복 할 일](../../apps/api/.claude/architecture.md#반복-할-일), [휴면·복귀](todo-series-dormancy.md)                                                                                                          |
| 할 일 떠 있는 시각                   | [규칙](../conventions/dates.md#5-떠-있는-시각), [서버 구현](todo-floating-time.md)                                                                                                                                    |
| GitHub Actions·Stack 검증            | [CI](ci.md)                                                                                                                                                                                                           |
| 운영 migration·이미지·배포·복구      | [Deployment](../../apps/api/DEPLOYMENT.md)                                                                                                                                                                            |
| 끝난 구조 전환의 기록                | [서버 구조 전환](migration.md)                                                                                                                                                                                        |

## 문서 유지 기준

- 지금 코드의 동작과 소유 레이어만 적는다. 없는 구현·명령을 예제로 남기지 않는다.
- 같은 규칙을 두 번 쓰지 않는다. 한 곳에 두고 링크한다.
- 이유, 외부 제약, QA에서 배운 함정은 남긴다.
- 외부 라이브러리 사용법은 공식 자료와 설치 버전으로 확인한다.
- 검증은 실제 실행 범위·조건·결과로 적는다. 로컬 통과, 병합, 운영 배포를 구분한다.
- `AGENTS.md`는 얇게 두고 `CLAUDE.md`는 그 파일을 가리킨다.
