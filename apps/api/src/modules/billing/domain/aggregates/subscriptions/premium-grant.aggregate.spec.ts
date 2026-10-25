import { PremiumGrant, type PremiumGrantProps } from "./premium-grant.aggregate.js";

function createGrant(overrides: Partial<PremiumGrantProps> = {}): PremiumGrant {
  return PremiumGrant.reconstitute({
    id: "grant-1",
    userId: "user-1",
    source: "INVITE",
    sourceKey: "invite:redemption-1:user-1",
    durationDays: 7,
    status: "BANKED",
    startsAt: null,
    endsAt: null,
    endingNotifiedAt: null,
    createdAt: new Date("2028-02-20T00:00:00.000Z"),
    ...overrides,
  });
}

describe("PremiumGrant", () => {
  it("쌓아 둔 기간을 시작하면 시작 시각에서 기간 일수만큼 뒤에 끝나고 다시 시작하면 false다", () => {
    // Given
    const grant = createGrant();
    const startsAt = new Date("2028-02-26T09:00:00.000Z");

    // When
    const results = [
      grant.activate(startsAt),
      grant.activate(new Date("2028-02-27T00:00:00.000Z")),
    ];

    // Then
    expect(results).toEqual([true, false]);
    expect(grant.toPersistence()).toEqual({
      status: "ACTIVE",
      startsAt,
      endsAt: new Date("2028-03-04T09:00:00.000Z"),
    });
  });

  it("끝나는 시각 전에는 끝내지 않고, 지나면 한 번만 ENDED로 바꾼다", () => {
    // Given
    const grant = createGrant({
      status: "ACTIVE",
      startsAt: new Date("2028-02-26T00:00:00.000Z"),
      endsAt: new Date("2028-03-04T00:00:00.000Z"),
    });

    // When
    const results = [
      grant.end(new Date("2028-03-03T23:59:59.999Z")),
      grant.end(new Date("2028-03-04T00:00:00.000Z")),
      grant.end(new Date("2028-03-05T00:00:00.000Z")),
    ];

    // Then
    expect(results).toEqual([false, true, false]);
    expect(grant.status).toBe("ENDED");
  });

  it("바로 시작하는 계획은 ACTIVE와 종료 시각을 함께 만든다", () => {
    // Given
    const startsAt = new Date("2028-02-26T00:00:00.000Z");

    // When
    const plan = PremiumGrant.planCreation({
      userId: "user-1",
      source: "INVITE",
      sourceKey: "invite:redemption-1:user-1",
      durationDays: 7,
      start: { kind: "activate", startsAt },
    });

    // Then
    expect(plan).toMatchObject({
      status: "ACTIVE",
      startsAt,
      endsAt: new Date("2028-03-04T00:00:00.000Z"),
    });
  });
});
