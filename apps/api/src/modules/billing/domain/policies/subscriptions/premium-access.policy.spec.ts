import {
  isPremiumGrantActive,
  isStoreEntitlementValid,
  isStoreSubscriptionRenewing,
  PremiumAccessPolicy,
  type PremiumGrantTerm,
  premiumGrantEndingNoticeUntil,
  premiumGrantEndsAt,
  remainingPremiumGrantDays,
  type StoreEntitlement,
} from "./premium-access.policy.js";

const NOW = new Date("2028-02-26T12:00:00.000Z");

function grant(overrides: Partial<PremiumGrantTerm> = {}): PremiumGrantTerm {
  return {
    id: "grant-1",
    status: "ACTIVE",
    durationDays: 7,
    startsAt: new Date("2028-02-23T00:00:00.000Z"),
    endsAt: new Date("2028-03-01T00:00:00.000Z"),
    createdAt: new Date("2028-02-20T00:00:00.000Z"),
    ...overrides,
  };
}

function banked(id: string, createdAt: string, durationDays = 7): PremiumGrantTerm {
  return grant({
    id,
    status: "BANKED",
    durationDays,
    startsAt: null,
    endsAt: null,
    createdAt: new Date(createdAt),
  });
}

function store(overrides: Partial<StoreEntitlement> = {}): StoreEntitlement {
  return { status: "ACTIVE", expiresAt: new Date("2028-03-10T00:00:00.000Z"), ...overrides };
}

describe("PremiumAccessPolicy", () => {
  describe("premiumGrantEndsAt", () => {
    it("윤년 2028-02-26에서 7일 뒤는 2028-03-04다", () => {
      // Given
      const startsAt = new Date("2028-02-26T00:00:00.000Z");

      // When
      const endsAt = premiumGrantEndsAt(startsAt, 7);

      // Then
      expect(endsAt).toEqual(new Date("2028-03-04T00:00:00.000Z"));
    });

    it("미국 서머타임이 시작되는 주(2028-03-12)를 지나도 7일은 정확히 168시간이다", () => {
      // Given
      const startsAt = new Date("2028-03-10T08:00:00.000Z");

      // When
      const endsAt = premiumGrantEndsAt(startsAt, 7);

      // Then
      expect(endsAt.getTime() - startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1_000);
    });
  });

  describe("isStoreEntitlementValid", () => {
    it.each([
      { status: "ACTIVE" as const, expiresAt: "2028-02-26T12:00:00.001Z", expected: true },
      // 자동 갱신 중이면 만료 뒤 3시간까지 갱신·만료 웹훅을 기다린다
      { status: "ACTIVE" as const, expiresAt: "2028-02-26T12:00:00.000Z", expected: true },
      { status: "ACTIVE" as const, expiresAt: "2028-02-26T09:00:00.001Z", expected: true },
      { status: "ACTIVE" as const, expiresAt: "2028-02-26T09:00:00.000Z", expected: false },
      { status: "CANCELLED" as const, expiresAt: "2028-02-27T00:00:00.000Z", expected: true },
      { status: "CANCELLED" as const, expiresAt: "2028-02-26T12:00:00.000Z", expected: false },
      { status: "EXPIRED" as const, expiresAt: "2028-03-01T00:00:00.000Z", expected: false },
    ])(
      "$status 구독이 $expiresAt에 끝나면 $expected를 반환한다",
      ({ status, expiresAt, expected }) => {
        // Given
        const subscription = store({ status, expiresAt: new Date(expiresAt) });

        // When
        const result = isStoreEntitlementValid(subscription, NOW);

        // Then
        expect(result).toBe(expected);
      },
    );
  });

  describe("premiumGrantEndingNoticeUntil", () => {
    it("지금부터 정확히 24시간 뒤까지 끝나는 기간을 안내 대상으로 본다", () => {
      // Given
      const now = NOW;

      // When
      const until = premiumGrantEndingNoticeUntil(now);

      // Then
      expect(until).toEqual(new Date("2028-02-27T12:00:00.000Z"));
    });
  });

  describe("resolve", () => {
    it("예전에 스토어와 겹쳐 시작한 기간이 남아 있으면 그 끝까지 스토어 출처로 본다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({ status: "CANCELLED", expiresAt: new Date("2028-02-28T00:00:00.000Z") }),
        ],
        premiumGrants: [grant({ endsAt: new Date("2028-03-04T00:00:00.000Z") })],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "STORE",
        endsAt: new Date("2028-03-04T00:00:00.000Z"),
        periodEndsAt: new Date("2028-03-04T00:00:00.000Z"),
        willRenew: false,
        bankedDays: 0,
        recentGrantEndedAt: null,
      });
    });

    it("스토어 구독이 만료돼도 진행 중인 보상 기간으로 프리미엄을 유지한다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({ status: "EXPIRED", expiresAt: new Date("2028-02-26T00:00:00.000Z") }),
        ],
        premiumGrants: [grant()],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "GRANT",
        endsAt: new Date("2028-03-01T00:00:00.000Z"),
        periodEndsAt: new Date("2028-03-01T00:00:00.000Z"),
        willRenew: false,
        bankedDays: 0,
        recentGrantEndedAt: null,
      });
    });

    it("보상 기간 중 또 받은 보상은 지금 기간 끝과 이어 붙인 전체 끝, 대기 일수로 따로 보인다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [grant(), banked("next", "2028-02-25T00:00:00.000Z")],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "GRANT",
        endsAt: new Date("2028-03-08T00:00:00.000Z"),
        periodEndsAt: new Date("2028-03-01T00:00:00.000Z"),
        willRenew: false,
        bankedDays: 7,
        recentGrantEndedAt: null,
      });
    });

    it("시작하지 않은 쌓아 둔 기간만 있으면 아직 프리미엄이 아니다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [banked("banked", "2028-02-25T00:00:00.000Z")],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: null,
        endsAt: null,
        periodEndsAt: null,
        willRenew: false,
        bankedDays: 7,
        recentGrantEndedAt: null,
      });
    });

    it("자동 갱신 중인 구독 뒤의 보상은 갱신 유예가 끝난 뒤부터 이어 붙인다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store()],
        premiumGrants: [
          banked("grant-1", "2028-02-21T00:00:00.000Z"),
          banked("grant-2", "2028-02-22T00:00:00.000Z", 14),
        ],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "STORE",
        endsAt: new Date("2028-03-31T03:00:00.000Z"),
        periodEndsAt: new Date("2028-03-10T00:00:00.000Z"),
        willRenew: true,
        bankedDays: 21,
        recentGrantEndedAt: null,
      });
    });

    it("취소한 구독 뒤의 보상은 스토어 만료 시각부터 빈틈 없이 이어 붙인다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store({ status: "CANCELLED" })],
        premiumGrants: [banked("banked", "2028-02-21T00:00:00.000Z")],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "STORE",
        endsAt: new Date("2028-03-17T00:00:00.000Z"),
        periodEndsAt: new Date("2028-03-10T00:00:00.000Z"),
        willRenew: false,
        bankedDays: 7,
        recentGrantEndedAt: null,
      });
    });

    it("갱신 웹훅을 기다리는 유예 시간에는 만료 시각이 지나도 스토어 출처로 갱신 예정이다", () => {
      // Given
      const expiresAt = new Date("2028-02-26T11:00:00.000Z");
      const entitlements = {
        storeSubscriptions: [store({ expiresAt })],
        premiumGrants: [banked("banked", "2028-02-21T00:00:00.000Z")],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "STORE",
        endsAt: new Date("2028-03-04T14:00:00.000Z"),
        periodEndsAt: expiresAt,
        willRenew: true,
        bankedDays: 7,
        recentGrantEndedAt: null,
      });
    });

    it("2028-02-29에 산 연간 구독은 저장된 만료 시각 그대로 보상을 잇는다", () => {
      // Given
      const now = new Date("2028-02-29T12:00:00.000Z");
      const storedExpiresAt = new Date("2029-02-28T12:00:00.000Z");
      const entitlements = {
        storeSubscriptions: [store({ status: "CANCELLED", expiresAt: storedExpiresAt })],
        premiumGrants: [banked("banked", "2028-02-29T12:00:00.000Z")],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, now);

      // Then
      expect(access).toMatchObject({
        source: "STORE",
        periodEndsAt: storedExpiresAt,
        endsAt: new Date("2029-03-07T12:00:00.000Z"),
      });
    });

    it.each([
      { expiresAt: "2028-02-26T12:00:00.001Z", source: "STORE" },
      { expiresAt: "2028-02-26T12:00:00.000Z", source: null },
    ])("취소한 구독이 $expiresAt에 끝나면 지금 출처는 $source다", ({ expiresAt, source }) => {
      // Given
      const entitlements = {
        storeSubscriptions: [store({ status: "CANCELLED", expiresAt: new Date(expiresAt) })],
        premiumGrants: [banked("banked", "2028-02-21T00:00:00.000Z")],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access.source).toBe(source);
      expect(access.bankedDays).toBe(7);
    });
  });

  describe("resolve의 최근 끝난 보상 기간", () => {
    it.each([
      { endedAt: "2028-02-19T12:00:00.001Z", expected: "2028-02-19T12:00:00.001Z" },
      { endedAt: "2028-02-19T12:00:00.000Z", expected: null },
    ])(
      "프리미엄이 아니고 마지막 보상이 $endedAt에 끝났으면 $expected를 반환한다",
      ({ endedAt, expected }) => {
        // Given
        const entitlements = {
          storeSubscriptions: [],
          premiumGrants: [],
          lastEndedGrantAt: new Date(endedAt),
        };

        // When
        const access = PremiumAccessPolicy.resolve(entitlements, NOW);

        // Then
        expect(access.recentGrantEndedAt).toEqual(expected == null ? null : new Date(expected));
      },
    );

    it("정리 전에 끝난 ACTIVE 기간도 끝난 보상으로 본다", () => {
      // Given
      const endedAt = new Date("2028-02-26T11:59:59.999Z");
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [grant({ endsAt: endedAt })],
        lastEndedGrantAt: new Date("2028-02-20T00:00:00.000Z"),
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toMatchObject({ source: null, recentGrantEndedAt: endedAt });
    });

    it("지금 스토어나 보상으로 프리미엄이면 끝난 보상을 알리지 않는다", () => {
      // Given
      const lastEndedGrantAt = new Date("2028-02-26T00:00:00.000Z");
      const subscribed = { storeSubscriptions: [store()], premiumGrants: [], lastEndedGrantAt };
      const granted = { storeSubscriptions: [], premiumGrants: [grant()], lastEndedGrantAt };

      // When
      const accesses = [subscribed, granted].map((entitlements) =>
        PremiumAccessPolicy.resolve(entitlements, NOW),
      );

      // Then
      expect(accesses.map((access) => access.recentGrantEndedAt)).toEqual([null, null]);
    });
  });

  describe("remainingPremiumGrantDays", () => {
    it.each([
      { endsAt: "2028-02-26T12:00:00.000Z", expected: 0 },
      { endsAt: "2028-02-26T12:00:00.001Z", expected: 1 },
      { endsAt: "2028-02-28T12:00:00.000Z", expected: 2 },
      { endsAt: "2028-02-28T12:00:00.001Z", expected: 3 },
      // 윤일 2028-02-29를 지나도 하루는 24시간이다
      { endsAt: "2028-03-02T12:00:00.000Z", expected: 5 },
    ])("$endsAt에 끝나는 기간을 지금 끊으면 $expected일이 남는다", ({ endsAt, expected }) => {
      // Given
      const current = grant({ endsAt: new Date(endsAt) });

      // When
      const days = remainingPremiumGrantDays(current, NOW);

      // Then
      expect(days).toBe(expected);
    });
  });

  describe("planNewGrantStart", () => {
    it("자동 갱신 중인 스토어 구독이 있으면 새 보상을 쌓아 둔다", () => {
      // Given
      const entitlements = { storeSubscriptions: [store()], premiumGrants: [] };

      // When
      const start = PremiumAccessPolicy.planNewGrantStart(entitlements, NOW);

      // Then
      expect(start).toEqual({ kind: "bank" });
    });

    it("진행 중인 보상이 있으면 미래 시작 기간을 만들지 않고 쌓아 둔다", () => {
      // Given
      const entitlements = { storeSubscriptions: [], premiumGrants: [grant()] };

      // When
      const start = PremiumAccessPolicy.planNewGrantStart(entitlements, NOW);

      // Then
      expect(start).toEqual({ kind: "bank" });
    });

    it("스토어 구독도 진행 중인 보상도 없으면 지금 시작한다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store({ status: "EXPIRED" })],
        premiumGrants: [grant({ status: "ENDED" })],
      };

      // When
      const start = PremiumAccessPolicy.planNewGrantStart(entitlements, NOW);

      // Then
      expect(start).toEqual({ kind: "activate", startsAt: NOW });
    });
  });

  describe("planReconciliation", () => {
    it("환불로 스토어 엔타이틀먼트가 끝나면 먼저 받은 기간 하나만 지금 시작하고 나머지는 쌓아 둔다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({ status: "EXPIRED", expiresAt: new Date("2028-03-10T00:00:00.000Z") }),
        ],
        premiumGrants: [
          banked("later", "2028-02-22T00:00:00.000Z"),
          banked("earlier", "2028-02-21T00:00:00.000Z", 3),
        ],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan).toEqual({
        rebankedGrantIds: [],
        splitGrantIds: [],
        activations: [{ grantId: "earlier", startsAt: NOW }],
        endedGrantIds: [],
      });
    });

    it("앞 기간이 끝나면 sweep이 늦어도 그 끝난 시각부터 다음 기간을 잇는다", () => {
      // Given
      const previousEndsAt = new Date("2028-02-26T11:55:00.000Z");
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [
          grant({ id: "previous", endsAt: previousEndsAt }),
          banked("next", "2028-02-25T00:00:00.000Z"),
        ],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan).toEqual({
        rebankedGrantIds: [],
        splitGrantIds: [],
        activations: [{ grantId: "next", startsAt: previousEndsAt }],
        endedGrantIds: ["previous"],
      });
    });

    it("2028-02-29T15:00Z(한국 03-01 자정)에 끝난 기간 뒤의 보상은 그 시각부터 7일이다", () => {
      // Given
      const previousEndsAt = new Date("2028-02-29T15:00:00.000Z");
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [
          grant({ id: "previous", endsAt: previousEndsAt }),
          banked("next", "2028-02-25T00:00:00.000Z"),
        ],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, previousEndsAt);
      const endsAt = premiumGrantEndsAt(previousEndsAt, 7);

      // Then
      expect(plan.activations).toEqual([{ grantId: "next", startsAt: previousEndsAt }]);
      expect(plan.endedGrantIds).toEqual(["previous"]);
      expect(endsAt).toEqual(new Date("2028-03-07T15:00:00.000Z"));
    });

    it("앞 기간이 끝난 뒤 스토어가 유효했으면 스토어가 끝난 시각부터 잇는다", () => {
      // Given
      const storeLapsedAt = new Date("2028-02-26T11:30:00.000Z");
      const entitlements = {
        storeSubscriptions: [store({ status: "EXPIRED", expiresAt: storeLapsedAt })],
        premiumGrants: [
          grant({ id: "previous", endsAt: new Date("2028-02-26T10:00:00.000Z") }),
          banked("next", "2028-02-25T00:00:00.000Z"),
        ],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan.activations).toEqual([{ grantId: "next", startsAt: storeLapsedAt }]);
    });

    it.each([
      {
        name: "취소한 구독은 만료 시각",
        subscription: { status: "CANCELLED" as const, expiresAt: "2028-02-26T11:50:00.000Z" },
        startsAt: "2028-02-26T11:50:00.000Z",
      },
      {
        name: "만료 웹훅을 받은 구독은 만료 시각",
        subscription: { status: "EXPIRED" as const, expiresAt: "2028-02-26T11:50:00.000Z" },
        startsAt: "2028-02-26T11:50:00.000Z",
      },
      {
        name: "갱신 웹훅이 끝내 오지 않은 자동 갱신 구독은 유예가 끝난 시각",
        subscription: { status: "ACTIVE" as const, expiresAt: "2028-02-26T08:30:00.000Z" },
        startsAt: "2028-02-26T11:30:00.000Z",
      },
      {
        name: "취소한 구독이 정확히 지금 끝나면 지금",
        subscription: { status: "CANCELLED" as const, expiresAt: "2028-02-26T12:00:00.000Z" },
        startsAt: "2028-02-26T12:00:00.000Z",
      },
    ])(
      "스토어 뒤에 쌓아 둔 기간은 sweep이 늦어도 $name부터 시작한다",
      ({ subscription, startsAt }) => {
        // Given
        const entitlements = {
          storeSubscriptions: [
            store({ status: subscription.status, expiresAt: new Date(subscription.expiresAt) }),
          ],
          premiumGrants: [banked("banked", "2028-02-21T00:00:00.000Z")],
        };

        // When
        const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

        // Then
        expect(plan.activations).toEqual([{ grantId: "banked", startsAt: new Date(startsAt) }]);
      },
    );

    it("쌓아 둔 기간을 받기 전에 끝난 스토어에는 이어 붙이지 않고 지금 시작한다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({ status: "EXPIRED", expiresAt: new Date("2028-02-20T00:00:00.000Z") }),
        ],
        premiumGrants: [banked("banked", "2028-02-25T00:00:00.000Z")],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan.activations).toEqual([{ grantId: "banked", startsAt: NOW }]);
    });

    it("정리가 오래 밀렸으면 그동안 끝났어야 할 기간은 시작과 함께 끝내고 다음 기간을 잇는다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [
          grant({ id: "previous", endsAt: new Date("2028-02-24T12:00:00.000Z") }),
          banked("short", "2028-02-20T00:00:00.000Z", 1),
          banked("long", "2028-02-21T00:00:00.000Z", 7),
        ],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan).toEqual({
        rebankedGrantIds: [],
        splitGrantIds: [],
        activations: [
          { grantId: "short", startsAt: new Date("2028-02-24T12:00:00.000Z") },
          { grantId: "long", startsAt: new Date("2028-02-25T12:00:00.000Z") },
        ],
        endedGrantIds: ["previous", "short"],
      });
    });

    it("진행 중인 기간이 있으면 쌓아 둔 기간을 시작하지 않는다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [grant(), banked("next", "2028-02-25T00:00:00.000Z")],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan).toEqual({
        rebankedGrantIds: [],
        splitGrantIds: [],
        activations: [],
        endedGrantIds: [],
      });
    });

    it("스토어 구독이 유효하면 쌓아 둔 기간을 시작하지 않고 끝난 기간만 닫는다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store()],
        premiumGrants: [
          grant({ id: "ended", endsAt: new Date("2028-02-26T12:00:00.000Z") }),
          banked("banked", "2028-02-25T00:00:00.000Z"),
        ],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan).toEqual({
        rebankedGrantIds: [],
        splitGrantIds: [],
        activations: [],
        endedGrantIds: ["ended"],
      });
    });

    it("갱신 웹훅을 기다리는 유예 시간에는 쌓아 둔 기간을 시작하지 않는다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store({ expiresAt: new Date("2028-02-26T09:30:00.000Z") })],
        premiumGrants: [banked("banked", "2028-02-25T00:00:00.000Z")],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan.activations).toEqual([]);
    });

    it("스토어가 다시 유효해지면 진행 중인 기간은 끊어 남은 일수를 쌓고 시작 전 기간은 다시 쌓는다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store()],
        premiumGrants: [
          grant({ id: "current" }),
          grant({
            id: "future",
            startsAt: new Date("2028-03-01T00:00:00.000Z"),
            endsAt: new Date("2028-03-08T00:00:00.000Z"),
          }),
        ],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan).toEqual({
        rebankedGrantIds: ["future"],
        splitGrantIds: ["current"],
        activations: [],
        endedGrantIds: [],
      });
    });

    it.each([
      { endsAt: "2028-02-26T12:00:00.000Z", split: [], ended: ["current"] },
      { endsAt: "2028-02-26T12:00:00.001Z", split: ["current"], ended: [] },
    ])(
      "구독을 산 시각에 $endsAt에 끝나는 기간은 끊기 $split, 끝내기 $ended다",
      ({ endsAt, split, ended }) => {
        // Given
        const entitlements = {
          storeSubscriptions: [store()],
          premiumGrants: [grant({ id: "current", endsAt: new Date(endsAt) })],
        };

        // When
        const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

        // Then
        expect(plan.splitGrantIds).toEqual(split);
        expect(plan.endedGrantIds).toEqual(ended);
      },
    );
  });

  describe("isPremiumGrantActive / isStoreSubscriptionRenewing", () => {
    it("끝나는 시각과 같으면 진행 중이 아니고, 취소한 구독은 남아 있어도 갱신되지 않는다", () => {
      // Given
      const endingNow = grant({ endsAt: NOW });
      const cancelled = store({ status: "CANCELLED" });

      // When
      const isActive = isPremiumGrantActive(endingNow, NOW);
      const isRenewing = isStoreSubscriptionRenewing(cancelled, NOW);

      // Then
      expect([isActive, isRenewing]).toEqual([false, false]);
      expect(isStoreSubscriptionRenewing(store(), NOW)).toBe(true);
    });
  });
});
