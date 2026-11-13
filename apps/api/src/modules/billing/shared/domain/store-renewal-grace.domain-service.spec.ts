import {
  STORE_RENEWAL_GRACE_MS,
  storeEntitlementEndsAt,
  storePeriodEndsAt,
  storeRenewalCutoff,
  storeRenewalGraceEndsAt,
} from "./store-renewal-grace.domain-service.js";

const EXPIRES_AT = Temporal.Instant.from("2028-03-04T00:00:00Z");
const GRACE_AFTER_WAIT = EXPIRES_AT.add({ milliseconds: STORE_RENEWAL_GRACE_MS });

describe("스토어 갱신 유예 — 엔타이틀먼트가 끝나는 시각", () => {
  it("자동 갱신 중이면 만료 뒤 웹훅을 기다리는 3시간까지다", () => {
    // Given
    const store = { status: "ACTIVE", expiresAt: EXPIRES_AT };

    // When
    const endsAt = storeEntitlementEndsAt(store);

    // Then
    expect(STORE_RENEWAL_GRACE_MS).toBe(3 * 60 * 60 * 1000);
    expect(endsAt).toEqual(GRACE_AFTER_WAIT);
    expect(storeRenewalGraceEndsAt(EXPIRES_AT)).toEqual(GRACE_AFTER_WAIT);
  });

  it("취소했으면 만료 시각까지이고 엔타이틀먼트 없는 상태는 null이다", () => {
    // Given
    const states = ["CANCELLED", "EXPIRED", "FREE"].map((status) => ({
      status,
      expiresAt: EXPIRES_AT,
    }));

    // When
    const endsAt = states.map((store) => storeEntitlementEndsAt(store));

    // Then
    expect(endsAt).toEqual([EXPIRES_AT, null, null]);
  });

  it("결제 유예가 더 늦으면 유예 끝까지 늘어나고 더 이르면 그대로다", () => {
    // Given
    const longGrace = EXPIRES_AT.add({ hours: 24 * 10 });
    const shortGrace = EXPIRES_AT.add({ hours: 1 });

    // When
    const extended = storeEntitlementEndsAt({
      status: "CANCELLED",
      expiresAt: EXPIRES_AT,
      gracePeriodEndsAt: longGrace,
    });
    const unchanged = storeEntitlementEndsAt({
      status: "ACTIVE",
      expiresAt: EXPIRES_AT,
      gracePeriodEndsAt: shortGrace,
    });

    // Then
    expect({ extended, unchanged }).toEqual({ extended: longGrace, unchanged: GRACE_AFTER_WAIT });
  });

  it("기간의 끝은 결제 유예가 있으면 유예 끝이고 웹훅 대기 유예는 더하지 않는다", () => {
    // Given
    const graceEndsAt = EXPIRES_AT.add({ hours: 24 });

    // When
    const withGrace = storePeriodEndsAt({
      status: "ACTIVE",
      expiresAt: EXPIRES_AT,
      gracePeriodEndsAt: graceEndsAt,
    });
    const withoutGrace = storePeriodEndsAt({ status: "ACTIVE", expiresAt: EXPIRES_AT });

    // Then
    expect({ withGrace, withoutGrace }).toEqual({
      withGrace: graceEndsAt,
      withoutGrace: EXPIRES_AT,
    });
  });

  it("SQL 기준 시각은 지금에서 3시간을 뺀 값이다", () => {
    // Given
    const now = Temporal.Instant.from("2028-03-04T12:00:00Z");

    // When
    const cutoff = storeRenewalCutoff(now);

    // Then
    expect(cutoff).toEqual(Temporal.Instant.from("2028-03-04T09:00:00Z"));
  });
});
