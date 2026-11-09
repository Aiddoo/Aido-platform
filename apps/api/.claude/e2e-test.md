# 서버 HTTP·E2E 테스트

HTTP pipeline의 인증·권한·validation·status·응답·저장 결과를 확인한다. 트랜잭션·동시성은 [Integration](./integration-test.md), 순수 분기는 [Unit](./unit-test.md)을 쓴다.

## 테스트 앱

[createE2eApp](../test/e2e/helpers/e2e-app-factory.ts)은 실제 AppModule과 configureApplication을 조립한다. 관리형 PostgreSQL을 연결하고 Email/OAuth/Push/AI/Discord/Weather/job runtime은 Fake·Stub으로 막는다.

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

- 각 케이스는 필요한 데이터를 스스로 준비한다. 이전 케이스의 데이터에 기대지 않는다.
- 새 provider override는 `customizeBuilder`, mutable Fake는 `additionalResetters`로 넣는다.
- `ctx.reset()`은 남은 domain event 작업을 비운 뒤 DB/cache/Redis/Fake를 정리한다. reset이 실패하면 그 환경의 다음 테스트를 멈춘다.

## 실제 HTTP에서 확인할 것

- 공개 route/method/header/query/body, 공유 Zod validation, nullable/default와 오류 우선순위
- 무인증 401, 비소유·역할·premium 경계, 상태에 맞는 코드
- HTTP 결과와 필요한 저장 상태. 준비·확인에 fixture/DB를 써도 되지만 endpoint 대신 UseCase를 부르지 않는다.
- 응답 body를 공유 schema로 `.parse`해 계약과 구현이 어긋나면 실패하게 한다.
- Fake 응답만으로 AI 품질이나 외부 발송 성공을 주장하지 않는다.

일반 endpoint는 성공 `{success:true,data,timestamp}`, 오류 `{success:false,error:{code,message,details?},timestamp}`다. `@RawResponse`인 `/v1/app-config/feature-discovery`와 `/v1/app-config/app-version`은 raw union과 `Cache-Control: private, no-store`를 돌려주므로 `data`를 기대하지 않는다.

```ts
// When
const response = await request(ctx.app.getHttpServer())
  .get("/v1/app-config/feature-discovery")
  .expect(200);

// Then
expect(response.headers["cache-control"]).toBe("private, no-store");
expect(response.body).toEqual({ enabled: false });
```

권한·상태코드·body 검증을 기대값 완화로 숨기지 않는다.

## 호환성·OpenAPI

[OpenAPI 계약 테스트](../test/e2e/openapi-contract.e2e-spec.ts)와 `test/e2e/fixtures/released-*-openapi-contract.ts`가 출시 앱의 응답 모양을 지킨다. 구 클라이언트 fingerprint를 현재 schema로 다시 만들지 않는다. 의도한 추가만 스냅샷을 갱신하고 diff가 추가만인지 확인한다([절차](rest-contracts.md#출시-앱-호환)).

```sh
pnpm --filter @aido/server test:contract
pnpm --filter @aido/server exec vitest run --project e2e test/e2e/openapi-contract.e2e-spec.ts -u
```

OpenAPI 일치는 공개 명세의 동일성만 뒷받침한다. DB 의미·모바일 화면·운영 배포를 증명하지 않는다.

## 설정·시간·외부 요청

- DB URL은 global setup이 준다. spec에서 `DATABASE_URL` fallback이나 기존 DB 공유를 더하지 않는다.
- throttle은 기본으로 꺼져 있다. throttle을 검증할 때만 `withRealThrottler: true`를 쓴다.
- worker/scheduler는 기본 앱에서 Fake다. durable worker·공급자 wire는 전용 PG/Adapter suite가 본다.
- DB/HTTP timer는 native로 둔다. 날짜가 필요한 케이스만 Date-only fake를 쓰고 복원한다.
- 실제 key·URI·token·문의/할 일 원문을 출력하지 않는다.

```sh
pnpm --filter @aido/server exec vitest run --project e2e test/e2e/inquiry.e2e-spec.ts --sequence.seed=101
```

작업 중에는 영향을 받는 endpoint와 계약만 돌린다. CI는 E2E를 돌리지 않는다.
