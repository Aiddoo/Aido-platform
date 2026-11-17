import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/session.fixture";

import { VerificationEmailCapAdapter } from "./verification-email-cap.adapter.js";

describe("VerificationEmailCapAdapter — 이메일 hash로 센 기록", () => {
  it("대소문자·앞뒤 공백이 달라도 같은 이메일의 기록을 읽고 키에 이메일 원문을 두지 않는다", async () => {
    // Given
    const store = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    const cap = new VerificationEmailCapAdapter(store);
    const sentAts = [AUTH_FIXTURE_NOW, AUTH_FIXTURE_NOW.add({ minutes: 1 })];

    // When
    await cap.saveSentAts(" User@Example.com ", sentAts);
    const found = await cap.findSentAts("user@example.com");

    // Then
    expect(found).toEqual(sentAts);
    expect(await store.delByPattern("*example.com*")).toBe(0);
  });
});
