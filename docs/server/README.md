# 서버 문서 안내

서버 작업에 필요한 문서를 고르는 진입점이다. 전체 문서를 순서대로 읽을 필요는 없다. 구현의 현재 상태는 코드·설정, 전환 완료와 검증 근거는 진행 기록으로 확인한다.

## 작업별 참조

| 작업                                 | 문서                                                                                                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 서버 작업의 공통 경계                | [AGENTS](../../apps/api/AGENTS.md)                                                                                                                                                                                    |
| 개발 환경·실행 명령                  | [API README](../../apps/api/README.md)                                                                                                                                                                                |
| Context·레이어·공개 capability       | [Architecture](../../apps/api/.claude/architecture.md)                                                                                                                                                                |
| 파일명·변수명·코드 작성              | [코드 규칙](../../apps/api/.claude/api-conventions.md), [명명](naming.md)                                                                                                                                             |
| 기존 앱 호환성·공유 Zod·HTTP 응답    | [REST 계약](../../apps/api/.claude/rest-contracts.md)                                                                                                                                                                 |
| ORM·transaction·schema 변경          | [Prisma](../../apps/api/.claude/prisma.md), [Prisma 8 검증](../../apps/api/docs/prisma8-verification.md)                                                                                                              |
| 의미 있는 Unit·실제 PG·HTTP 검증     | [테스트 선택](../../apps/api/.claude/testing-guide.md); 필요한 경우 [Unit](../../apps/api/.claude/unit-test.md), [Integration](../../apps/api/.claude/integration-test.md), [E2E](../../apps/api/.claude/e2e-test.md) |
| 로그·민감정보                        | [로깅](../../apps/api/.claude/logging-guide.md)                                                                                                                                                                       |
| 알림·다국어·receipt·queue            | [Push Notifications](../../apps/api/docs/push-notifications.md)                                                                                                                                                       |
| GitHub Actions·Stack 검증            | [CI](ci.md)                                                                                                                                                                                                           |
| 운영 migration·이미지·배포·복구      | [Deployment](../../apps/api/DEPLOYMENT.md)                                                                                                                                                                            |
| 단계별 Before/After·측정·미확인 사항 | [서버 구조 전환](migration.md)                                                                                                                                                                                        |

## 문서 유지 기준

현재 코드가 설명하는 동작과 소유 레이어만 적는다. 삭제된 구현·명령을 현행 예제로 남기지 않는다. 외부 API·라이브러리 사용법은 공식 자료와 설치 버전을 확인하고, 버전은 package/lockfile을 기준으로 판단한다.

`AGENTS.md`는 짧은 공통 경계와 참조 경로를 유지하고, `CLAUDE.md`는 그 파일을 가리킨다. 상세 설명은 위 문서의 해당 책임에 둔다. 같은 규칙을 여러 문서에 복사하거나 매 편집마다 전체 읽기·전체 테스트를 강제하지 않는다.

검증은 실제 실행 범위·조건·결과를 적는다. 코드 품질 개선과 측정한 성능 개선, 로컬 테스트·병합·운영 배포를 구분한다. 운영 사용자 영향은 회귀 테스트 통과만으로 단정하지 않고 적용 순서와 배포 후 상태까지 확인한다.

현재 진행 기록에서 00–17은 구현·로컬 검증 완료이며 마지막 CI·병합·운영 배포 확인은 별도 진행한다. 문서 정리는 미완료 모듈이나 운영 배포의 완료를 뜻하지 않는다. 이전 단계의 결과는 당시 조건의 기록으로 보존한다.

작성 원칙의 참고: [OpenAI의 skills·AGENTS 정리 지침](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra). 이 문서는 특정 모델의 성능·자동 안전성을 전제로 삼지 않는다.
