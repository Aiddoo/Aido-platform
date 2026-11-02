import { PremiumGrant, type PremiumGrantProps } from "./premium-grant.aggregate.js";

function createGrant(overrides: Partial<PremiumGrantProps> = {}): PremiumGrant {
  return PremiumGrant.reconstitute({
    id: "grant-1",
    userId: "user-1",
    source: "INVITE",
    sourceKey: "invite:redemption-1:user-1",
    durationDays: 7,
    durationMs: null,
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
    if (accepted) {
      expect(plan()).toMatchObject({ status: "BANKED", sourceKey: input.sourceKey });
    } else {
      expect(plan).toThrow(expect.objectContaining({ errorCode: "SYS_0002" }));
    }
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

  it("진행 중인 기간을 끊으면 그 시각에 끝내고 남은 일수를 처음 받은 순서로 쌓는 계획을 낸다", () => {
    // Given
    const grant = createGrant({
      status: "ACTIVE",
      startsAt: new Date("2028-02-26T00:00:00.000Z"),
      endsAt: new Date("2028-03-04T00:00:00.000Z"),
    });
    const at = new Date("2028-02-28T00:00:00.000Z");

    // When
    const remainder = grant.splitAt(at);

    // Then
    expect(remainder).toEqual({
      userId: "user-1",
      source: "INVITE",
      sourceKey: "rebank:grant-1",
      durationDays: 5,
      durationMs: 5 * 24 * 60 * 60 * 1_000,
      status: "BANKED",
      startsAt: null,
      endsAt: null,
      createdAt: new Date("2028-02-20T00:00:00.000Z"),
    });
    expect(grant.toPersistence()).toEqual({
      status: "ENDED",
      startsAt: new Date("2028-02-26T00:00:00.000Z"),
      endsAt: at,
    });
    expect(grant.splitAt(at)).toBeNull();
  });

  it("같은 기간을 두 번 끊어도 일수를 올림한 만큼 늘지 않고 남은 ms 그대로 이어진다", () => {
    // Given
    const DAY_MS = 24 * 60 * 60 * 1_000;
    const grant = createGrant({
      status: "ACTIVE",
      startsAt: new Date("2028-02-26T00:00:00.000Z"),
      endsAt: new Date("2028-03-04T00:00:00.000Z"),
    });
    const firstCutAt = new Date("2028-02-27T21:00:00.000Z");
    const first = grant.splitAt(firstCutAt);
    const remainder = createGrant({
      id: "grant-2",
      durationDays: first?.durationDays ?? 0,
      durationMs: first?.durationMs ?? null,
    });
    const resumedAt = new Date("2028-03-10T00:00:00.000Z");
    remainder.activate(resumedAt);
    const resumedEndsAt = remainder.endsAt;

    // When
    const second = remainder.splitAt(new Date("2028-03-11T09:00:00.000Z"));

    // Then 7일 중 1일 21시간을 써서 5일 3시간, 다시 1일 9시간을 써서 3일 18시간 남는다
    expect(first).toMatchObject({ durationDays: 6, durationMs: 5 * DAY_MS + 3 * 3_600_000 });
    expect(resumedEndsAt).toEqual(new Date(resumedAt.getTime() + 5 * DAY_MS + 3 * 3_600_000));
    expect(second).toMatchObject({ durationDays: 4, durationMs: 3 * DAY_MS + 18 * 3_600_000 });
  });

  it.each([
    { name: "쌓아 둔 기간", overrides: {} },
    {
      name: "아직 시작하지 않은 기간",
      overrides: {
        status: "ACTIVE" as const,
        startsAt: new Date("2028-02-28T00:00:00.001Z"),
        endsAt: new Date("2028-03-06T00:00:00.001Z"),
      },
    },
    {
      name: "정확히 지금 끝나는 기간",
      overrides: {
        status: "ACTIVE" as const,
        startsAt: new Date("2028-02-21T00:00:00.000Z"),
        endsAt: new Date("2028-02-28T00:00:00.000Z"),
      },
    },
  ])("$name은 끊지 않는다", ({ overrides }) => {
    // Given
    const grant = createGrant(overrides);

    // When
    const remainder = grant.splitAt(new Date("2028-02-28T00:00:00.000Z"));

    // Then
    expect(remainder).toBeNull();
    expect(grant.status).toBe(overrides.status ?? "BANKED");
  });

  describe("revoke", () => {
    const AT = new Date("2028-02-26T09:00:00.000Z");

    it("쌓아 둔 기간은 시작 시각 없이 REVOKED가 되고 다시 취소하면 false다", () => {
      // Given
      const grant = createGrant();

      // When
      const results = [grant.revoke(AT), grant.revoke(AT)];

      // Then
      expect(results).toEqual([true, false]);
      expect(grant.toPersistence()).toEqual({ status: "REVOKED", startsAt: null, endsAt: null });
    });

    it("진행 중인 기간은 취소 시각에 끝낸다", () => {
      // Given
      const startsAt = new Date("2028-02-25T09:00:00.000Z");
      const grant = createGrant({
        status: "ACTIVE",
        startsAt,
        endsAt: new Date("2028-03-03T09:00:00.000Z"),
      });

      // When
      const revoked = grant.revoke(AT);

      // Then
      expect(revoked).toBe(true);
      expect(grant.toPersistence()).toEqual({ status: "REVOKED", startsAt, endsAt: AT });
    });

    it.each([
      { status: "ENDED" as const, endsAt: new Date("2028-02-20T00:00:00.000Z") },
      { status: "ACTIVE" as const, endsAt: new Date("2028-02-26T09:00:00.000Z") },
    ])("이미 끝난 $status 기간은 바꾸지 않는다", ({ status, endsAt }) => {
      // Given
      const grant = createGrant({ status, startsAt: new Date("2028-02-19T00:00:00.000Z"), endsAt });

      // When
      const revoked = grant.revoke(AT);

      // Then
      expect(revoked).toBe(false);
      expect(grant.status).toBe(status);
    });
  });
});
