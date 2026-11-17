import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import { AUTH_FIXTURE_NOW } from "#test/fixtures/identity/session.fixture";

import { VerificationEmailCapAdapter } from "./verification-email-cap.adapter.js";

describe("VerificationEmailCapAdapter — 이메일 hash로 센 기록", () => {
  it("대소문자·앞뒤 공백이 달라도 같은 이메일의 기록을 읽고 키에 이메일·IP 원문을 두지 않는다", async () => {
    // Given
    const store = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    const cap = new VerificationEmailCapAdapter(store);
    const sentAts = [AUTH_FIXTURE_NOW, AUTH_FIXTURE_NOW.add({ minutes: 1 })];

    // When
    await cap.saveSentAts(
      {
        scope: "email-source",
        purpose: "PASSWORD_RESET",
        email: " User@Example.com ",
        sourceIp: "192.0.2.10",
      },
      sentAts,
    );
    const found = await cap.findSentAts({
      scope: "email-source",
      purpose: "PASSWORD_RESET",
      email: "user@example.com",
      sourceIp: "192.0.2.10",
    });

    // Then
    expect(found).toEqual(sentAts);
    expect(await store.delByPattern("*example.com*")).toBe(0);
    expect(await store.delByPattern("*192.0.2.10*")).toBe(0);
  });

  it("용도·IP가 다르면 같은 이메일이어도 다른 기록이다", async () => {
    // Given
    const store = new InMemoryCacheStore({ defaultTtlMs: 60_000, maxItems: 100 });
    const cap = new VerificationEmailCapAdapter(store);
    const email = "user@example.com";
    await cap.saveSentAts({ scope: "email", purpose: "PASSWORD_RESET", email }, [AUTH_FIXTURE_NOW]);
    await cap.saveSentAts(
      { scope: "email-source", purpose: "EMAIL_VERIFY", email, sourceIp: "192.0.2.10" },
      [AUTH_FIXTURE_NOW],
    );

    // When
    const otherPurpose = await cap.findSentAts({ scope: "email", purpose: "EMAIL_VERIFY", email });
    const otherSource = await cap.findSentAts({
      scope: "email-source",
      purpose: "EMAIL_VERIFY",
      email,
      sourceIp: "198.51.100.7",
    });

    // Then
    expect(otherPurpose).toEqual([]);
    expect(otherSource).toEqual([]);
  });
});
