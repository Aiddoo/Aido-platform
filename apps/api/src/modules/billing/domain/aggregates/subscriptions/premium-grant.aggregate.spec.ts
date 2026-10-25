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

  it.each([0, -1, 1.5])("기간 일수가 %s이면 생성 계획을 거부한다", (durationDays) => {
    // Given
    const input = {
      userId: "user-1",
      source: "INVITE" as const,
      sourceKey: "invite:redemption-1:user-1",
      durationDays,
      start: { kind: "bank" as const },
    };

    // When
    const plan = () => PremiumGrant.planCreation(input);

    // Then
    expect(plan).toThrow(expect.objectContaining({ errorCode: "SYS_0002" }));
  });

  it.each([
    { length: 0, accepted: false },
    { length: 128, accepted: true },
    { length: 129, accepted: false },
  ])("sourceKey 길이 $length는 허용 여부가 $accepted다", ({ length, accepted }) => {
    // Given
    const input = {
      userId: "user-1",
      source: "INVITE" as const,
      sourceKey: "k".repeat(length),
      durationDays: 7,
      start: { kind: "bank" as const },
    };

    // When
    const plan = () => PremiumGrant.planCreation(input);

    // Then
    if (accepted) expect(plan()).toMatchObject({ status: "BANKED", sourceKey: input.sourceKey });
    else expect(plan).toThrow(expect.objectContaining({ errorCode: "SYS_0002" }));
  });

  it("아직 시작하지 않은 ACTIVE 기간만 다시 쌓아 두고 진행 중인 기간은 그대로 둔다", () => {
    // Given
    const at = new Date("2028-02-26T00:00:00.000Z");
    const future = createGrant({
      status: "ACTIVE",
      startsAt: new Date("2028-03-01T00:00:00.000Z"),
      endsAt: new Date("2028-03-08T00:00:00.000Z"),
    });
    const running = createGrant({
      status: "ACTIVE",
      startsAt: at,
      endsAt: new Date("2028-03-04T00:00:00.000Z"),
    });

    // When
    const results = [future.rebank(at), running.rebank(at), future.rebank(at)];

    // Then
    expect(results).toEqual([true, false, false]);
    expect(future.toPersistence()).toEqual({ status: "BANKED", startsAt: null, endsAt: null });
  });
});
