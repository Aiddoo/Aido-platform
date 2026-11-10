# 외부 호출

외부 공급자(AI·푸시·메일·날씨·OAuth·결제·Discord)를 부르는 어댑터를 만들거나 바꿀 때 읽는다. 새 어댑터 PR은 아래 체크리스트를 채운다. 포트 교체 기준은 [아키텍처](architecture.md#교체-가능한-포트)에 있다.

## 호출 정책

- 외부 호출은 `OutboundPolicyRegistry.get(spec)`의 `OutboundPolicy.execute((signal) => …, signal)` 안에서 한다(`platform/resilience`, cockatiel: bulkhead → 회로 → Aggressive timeout). 정책 값은 소유 slice infrastructure의 `<vendor>-outbound.policy.ts` 상수다.
- HTTP는 `@nestjs/http-client` named client(`retry: false`, `throwOnHttpError: false`)로 보내고 마감은 `AbortSignal.timeout`이다.
- 재시도 층은 한 호출에 하나다. 요청 안에서는 전송 계층 내장(AI SDK `maxRetries`, Expo SDK), 비동기는 pg-boss다. cockatiel `retry`는 쓰지 않는다.
- 회로를 다는 기준: 호출마다 돈이 들거나, 요청 경로에서 대기가 쌓이거나, 배치가 많은 호출로 퍼질 때. 로그인·관리자 알림은 거절 경로를 만들지 않으려고 회로·bulkhead 없이 둔다. 상태는 프로세스 메모리다.
- 회로 로그는 `outbound.circuit.{opened,half-open,closed}`, 대기열 초과는 `outbound.bulkhead.rejected`다.
- 누적 사용량은 `UsageMeterPort`(`add`·`tryReserve`·`release`·`read`·`prune`, `OutboundUsage` 원자적 upsert)로 센다. 기간은 UTC 일·월이고 기준선 경보는 기간당 한 번이다. 90일 지난 행은 정리 작업이 지운다.

## 체크리스트

| 항목          | 규칙                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 시간 초과     | 호출마다 timeout, 요청 경로는 전체 마감 안에서. 클라이언트가 끊으면 `ClientAbortSignal`로 취소                                   |
| 재시도        | 안전한(읽기·멱등) 호출과 재시도 가능한 오류(429·5xx·네트워크)만. 지수 backoff + 지터, `Retry-After` 존중                         |
| 멱등 키       | 쓰기 호출은 공급자 멱등 키를 쓴다(예: 메일 `deliveryId`를 idempotency key로)                                                     |
| 회로·bulkhead | 비용·지연이 쌓이는 호출에                                                                                                        |
| 응답 검증     | `*.wire.ts` Zod `parse`. 실패는 `PROVIDER_CONTRACT_CHANGED`로 분류하고 경보                                                      |
| 오류 분류     | 공급자 오류를 `ProviderFailure = timeout \| rate-limited \| unavailable \| rejected \| contract-changed`로 번역, ts-pattern 분기 |
| 인증 토큰     | 공급자 토큰(WeatherKit JWT, Apple JWKS)은 만료 전에 갱신·캐시. 서명 검증은 `clockTolerance`로 시계 오차 허용                     |
| 개인정보·로그 | 공급자 이름·상태·짧은 코드만. 본문·키·사용자 원문 금지([관측](observability.md#남기면-안-되는-값))                               |
| 비용·한도     | `OutboundUsage` 계량, 예산·킬 스위치(AI)                                                                                         |
| 연결          | undici keep-alive 공유, 공급자별 named client                                                                                    |
| 폴백          | 공급자 체인(AI), 오래된 캐시 제공(날씨)                                                                                          |
| 테스트        | msw + 고정 원문 fixture로 성공·429·5xx·시간 초과·schema 불일치([테스트](testing.md))                                             |

공급자 이름은 어댑터 파일·클래스·`*.wire.ts`에만 쓰고, 공급자 정책·계산(예: KMA 한국 범위·투영)을 중립 Domain 값(`Coordinate`)에 섞지 않는다.

## 전환 중

지금 정책 상수는 `ai-outbound.policies.ts`·`weather-outbound.policies.ts`·`email-outbound.policy.ts`·`expo-outbound.policy.ts`·`oauth-outbound.policies.ts`·`discord-outbound.policy.ts`처럼 Context infrastructure에 있고, 응답 검증·오류 분류는 공급자마다 다르며 어댑터 테스트는 손으로 쓴 HTTP Stub이다. 각 Context를 옮길 때 위 체크리스트로 맞춘다.
