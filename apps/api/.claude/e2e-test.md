# 서버 HTTP·E2E 테스트

HTTP pipeline의 인증·권한·validation·status·응답·저장 결과를 확인한다. 실제 transaction/동시성의 상세 증거는 [Integration](./integration-test.md), 순수 분기는 [Unit](./unit-test.md)을 사용한다. 동일 계약을 Controller forwarding mock으로 반복하지 않는다.

## 기존 테스트 앱 사용

[createE2eApp](../test/e2e/helpers/e2e-app-factory.ts)은 실제 AppModule과 configureApplication을 조립한다. 관리형 PostgreSQL client를 연결하고 Email/OAuth/Push/AI/Discord/Weather/job runtime은 기존 Fake로 격리한다. cache/Redis 대역과 domain event drain도 함께 관리한다. HTTP 서버는 suite 동안 `127.0.0.1`의 임의 포트를 사용한다.

일반 흐름은 `createE2eApp()`·`ctx.reset()`·`destroyE2eApp()` 및 `ctx.helpers`를 재사용한다. 전용 raw/public route의 작은 Nest HTTP Integration처럼 목적에 맞는 기존 harness가 있다면 그것을 사용할 수 있다. 문서 형식 때문에 모든 테스트를 하나의 거대한 앱이나 새 wrapper로 바꾸지 않는다.

```ts
import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("문의 HTTP", () => {
  let ctx: E2eTestContext;
  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);
  beforeEach(async () => {
    await ctx.reset();
  });
  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it("인증된 사용자 문의를 접수하고 성공 메시지를 반환한다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("inquiry@example.test", "Test1234!");
    // When
    const response = await request(ctx.app.getHttpServer())
      .post("/v1/inquiries")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ category: "OTHER", content: "확인하고 싶은 합성 문의입니다." })
      .expect(201);
    // Then
    expect(response.body.data.message).toBe("문의가 접수되었습니다.");
  });
});
```

각 케이스는 필요한 사용자/데이터를 자체 준비한다. 연속 CRUD처럼 한 업무 시나리오라면 하나의 `it`로 묶을 수 있다. `ctx`·suite 전용 fixture를 제외한 이전 케이스의 데이터에 의존하지 않는다. 새 provider override는 `customizeBuilder`로 넣고 mutable Fake는 `additionalResetters`에 등록한다.

`ctx.reset()`은 잔류 domain event 작업을 drain한 뒤 DB/cache/Redis/Fake를 정리한다. reset이 실패하면 해당 환경의 후속 테스트를 중단한다. 앱·cache/Redis·DB 종료 순서는 팩토리가 소유하며 global setup은 관리형 DB/컨테이너를 제거한다. 테스트 도중 실패했더라도 teardown을 실행한다. 자원 소유·잔여 확인은 [Integration](./integration-test.md)의 관리형 DB 규칙을 따른다.

## 실제 HTTP에서 확인할 것

- 공개 route/method/header/query/body, 공유 Zod validation, nullable/default와 오류 우선순위
- 무인증401, 비소유/역할/권한·premium 경계, 실제 상태에 맞는 성공/실패 코드
- HTTP 결과와 실제 필요한 저장 상태/후속 효과. HTTP 테스트의 준비·결과 확인에 fixture/DB를 사용할 수 있지만 endpoint 대신 UseCase를 직접 호출하지 않는다.
- 입력 원문 보존·누락된 시간/수량을 발명하지 않는 등 의미 계약은 fixture로 보호한다. Fake 응답만으로 실제 AI 품질이나 외부 발송 성공을 주장하지 않는다.

일반 endpoint는 성공 `{success:true,data,timestamp}`와 오류 `{success:false,error:{code,message},timestamp}` envelope를 사용한다. **모든 응답이 래핑되는 것은 아니다.** `@RawResponse`인 AppConfig `/v1/app-config/feature-discovery`와 `/v1/app-config/app-version`은 raw discriminated union과 `Cache-Control: private, no-store`를 반환한다. body에서 `data`를 기대하지 않는다. 정본 schema와 Controller를 읽고 해당 endpoint의 실제 계약을 검증한다.

비활성 설정을 준비한 실제 HTTP 테스트의 검증은 다음과 같다. 일반 문의 예제의 `response.body.data`와 다르게 raw body 전체를 비교한다.

```ts
// Given - 해당 harness의 config Port는 { enabled: false }를 반환한다.
const response = await request(ctx.app.getHttpServer())
  .get("/v1/app-config/feature-discovery")
  .expect(200);
expect(response.headers["cache-control"]).toBe("private, no-store");
expect(response.body).toEqual({ enabled: false });
```

기존 권한·상태코드·body assertions를 기대값 완화로 숨기지 않는다. 새 의미 검증이나 fixture/type/import 정렬로 테스트를 수정했다면 변경 이유와 보존된 assertions를 적는다. 모든 E2E 파일을 무수정해야 한다는 절대 규칙 대신, 리팩터링에서 기존 공개 계약이 유지되는지를 확인한다.

## 호환성·OpenAPI

[OpenAPI 계약 테스트](../test/e2e/openapi-contract.e2e-spec.ts)와 `test/e2e/fixtures/released-*-openapi-contract.ts`는 현재 문서와 배포 클라이언트의 기존 shape를 보호한다. 구 클라이언트 fingerprint를 현재 schema로 다시 생성하지 않는다. 의도적인 공개 계약 변경이 아니라면 snapshot update로 차이를 승인하지 않는다.

AppConfig raw oneOf/header처럼 전용 route contract가 있는 경우 그 실제 HTTP/Swagger assertions도 유지한다. OpenAPI diff0은 공개 명세의 동일성을 뒷받침하지만 DB 의미·SDK wire·모바일 화면·운영 배포까지 증명하지는 않는다.

## 설정·시간·외부 요청

DB global setup/setup-env가 실행별 관리 URL과 marker를 제공한다. spec에서 운영 `DATABASE_URL` fallback이나 기존 DB 공유를 추가하지 않는다. 실제 key·연결 URI·bearer token·문의/할 일 원문을 출력하지 않는다.

throttle은 기본 harness에서 격리된다. throttle 자체를 검증할 때만 `withRealThrottler:true`로 실제 guard를 사용한다. 다른 suite의 guard prototype을 바꾸지 않는다. worker/scheduler는 기본 E2E 앱에서 no-op/Fake이므로 durable worker·실제 공급자 wire 증거는 전용 PG/Adapter suite가 담당한다.

일반 DB/HTTP timer는 native로 유지한다. 날짜가 필요한 케이스만 Date-only fake를 쓰고 `finally`/`afterEach`에서 복원한다. timezone header, locale, 저장 UTC instant와 calendar DATE는 별개 입력이다. DST·자정·week boundary는 변경된 동작에 필요한 실제 날짜/기간만 검증한다.

```sh
pnpm --filter @aido/server exec vitest run --project e2e test/e2e/inquiry.e2e-spec.ts --sequence.seed=101
pnpm --filter @aido/server exec vitest run --project e2e test/e2e/openapi-contract.e2e-spec.ts
```

작업 중에는 영향을 받는 endpoint와 계약만 실행한다. 통과한 무관한 E2E 전체를 매 수정마다 반복하지 않는다. 최종 동결 뒤 전체 gate·완료 기록은 [testing-guide.md](./testing-guide.md)를 따른다.
