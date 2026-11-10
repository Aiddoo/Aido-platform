import { setTimeout as sleep } from "node:timers/promises";

import request from "supertest";

import { createE2eApp, destroyE2eApp } from "./helpers/index.js";
import { preparePgBossSchema, useRealJobRuntime } from "./helpers/real-job-runtime.js";

// Vitest fork worker의 stdin·stdout·stderr·IPC 파이프다. 앱과 무관하게 처음부터 열려 있다
const STDIO_RESOURCES = new Set(["PipeWrap", "TTYWrap"]);
// app.close()가 끝난 뒤에도 HTTP keep-alive 소켓과 server handle은 다음 tick들에 닫힌다(측정 50ms 안팎)
const SETTLE_DEADLINE_MS = 1_000;

function nonStdioResources(): string[] {
  return process.getActiveResourcesInfo().filter((resource) => !STDIO_RESOURCES.has(resource));
}

async function waitForResourcesToSettle(): Promise<string[]> {
  const deadline = Date.now() + SETTLE_DEADLINE_MS;
  let remaining = nonStdioResources();
  while (remaining.length > 0 && Date.now() < deadline) {
    await sleep(50);
    remaining = nonStdioResources();
  }
  return remaining;
}

it("실제 job runtime으로 띄운 앱을 닫으면 앱이 만든 타이머·소켓·풀이 하나도 남지 않는다", async () => {
  // Given
  await preparePgBossSchema();
  const ctx = await createE2eApp({ customizeBuilder: useRealJobRuntime });
  const user = await ctx.helpers.createVerifiedUser("shutdown-handles@example.com", "Test1234!");
  const categoryId = await ctx.helpers.getDefaultCategoryId(user.accessToken);
  await request(ctx.app.getHttpServer())
    .post("/v1/todos")
    .set("Authorization", `Bearer ${user.accessToken}`)
    .set("X-Timezone", "Asia/Seoul")
    .send({ title: "종료 확인", categoryId, startDate: "2026-11-10" })
    .expect(201);
  await request(ctx.app.getHttpServer())
    .get("/v1/todos")
    .set("Authorization", `Bearer ${user.accessToken}`)
    .set("X-Timezone", "Asia/Seoul")
    .expect(200);
  expect(nonStdioResources()).toContain("Timeout");

  // When
  await destroyE2eApp(ctx);

  // Then
  expect(await waitForResourcesToSettle()).toEqual([]);
});
