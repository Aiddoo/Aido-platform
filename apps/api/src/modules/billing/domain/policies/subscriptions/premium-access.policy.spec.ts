import {
  isStoreEntitlementValid,
  PremiumAccessPolicy,
  type PremiumGrantTerm,
  premiumGrantEndingNoticeUntil,
  premiumGrantEndsAt,
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
    it("스토어 구독과 보상 기간 중 늦게 끝나는 시각을 프리미엄 종료로 본다", () => {
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
        willRenew: false,
        bankedDays: 0,
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
        willRenew: false,
        bankedDays: 0,
      });
    });

    it("스토어가 없으면 진행 중인 기간 뒤에 쌓아 둔 기간을 이어 붙인 끝까지 프리미엄이다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [grant(), banked("next", "2028-02-25T00:00:00.000Z", 3)],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "GRANT",
        endsAt: new Date("2028-03-04T00:00:00.000Z"),
        willRenew: false,
        bankedDays: 0,
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
      expect(access).toEqual({ source: null, endsAt: null, willRenew: false, bankedDays: 7 });
    });

    it("스토어 구독 중 쌓아 둔 보상 일수를 합쳐 함께 보여 준다", () => {
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
      expect(access).toMatchObject({ source: "STORE", willRenew: true, bankedDays: 21 });
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
        endsAt: expiresAt,
        willRenew: true,
        bankedDays: 7,
      });
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
        activations: [{ grantId: "next", startsAt: previousEndsAt }],
        endedGrantIds: ["previous"],
      });
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
      expect(plan).toEqual({ rebankedGrantIds: [], activations: [], endedGrantIds: [] });
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
      expect(plan).toEqual({ rebankedGrantIds: [], activations: [], endedGrantIds: ["ended"] });
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

    it("스토어가 다시 유효해지면 아직 시작하지 않은 ACTIVE 기간을 다시 쌓아 둔다", () => {
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
      expect(plan).toEqual({ rebankedGrantIds: ["future"], activations: [], endedGrantIds: [] });
    });
  });
});
