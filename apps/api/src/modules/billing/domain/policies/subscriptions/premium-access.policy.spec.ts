import {
  isStoreEntitlementValid,
  nextPremiumGrantStartsAt,
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
    endsAt: new Date("2028-03-01T00:00:00.000Z"),
    createdAt: new Date("2028-02-20T00:00:00.000Z"),
    ...overrides,
  };
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
  });

  describe("isStoreEntitlementValid", () => {
    it.each([
      { status: "ACTIVE" as const, expiresAt: "2028-02-26T12:00:00.001Z", expected: true },
      { status: "CANCELLED" as const, expiresAt: "2028-02-27T00:00:00.000Z", expected: true },
      { status: "ACTIVE" as const, expiresAt: "2028-02-26T12:00:00.000Z", expected: false },
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

  describe("nextPremiumGrantStartsAt", () => {
    it("진행 중인 기간이 있으면 그 기간이 끝나는 시각부터 이어 붙인다", () => {
      // Given
      const grants = [grant({ endsAt: new Date("2028-03-01T00:00:00.000Z") })];

      // When
      const startsAt = nextPremiumGrantStartsAt(grants, NOW);

      // Then
      expect(startsAt).toEqual(new Date("2028-03-01T00:00:00.000Z"));
    });

    it("진행 중인 기간이 없으면 지금 시작한다", () => {
      // Given
      const grants = [grant({ status: "ENDED" }), grant({ status: "BANKED", endsAt: null })];

      // When
      const startsAt = nextPremiumGrantStartsAt(grants, NOW);

      // Then
      expect(startsAt).toEqual(NOW);
    });
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

    it("쌓아 둔 기간만 있으면 프리미엄이 아니다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [grant({ status: "BANKED", endsAt: null })],
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
          grant({ id: "grant-1", status: "BANKED", endsAt: null }),
          grant({ id: "grant-2", status: "BANKED", durationDays: 14, endsAt: null }),
        ],
      };

      // When
      const access = PremiumAccessPolicy.resolve(entitlements, NOW);

      // Then
      expect(access).toMatchObject({ source: "STORE", willRenew: true, bankedDays: 21 });
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

    it("스토어 구독이 없으면 진행 중인 보상 뒤에 이어 붙인다", () => {
      // Given
      const entitlements = { storeSubscriptions: [], premiumGrants: [grant()] };

      // When
      const start = PremiumAccessPolicy.planNewGrantStart(entitlements, NOW);

      // Then
      expect(start).toEqual({ kind: "activate", startsAt: new Date("2028-03-01T00:00:00.000Z") });
    });
  });

  describe("planReconciliation", () => {
    it("환불로 스토어 엔타이틀먼트가 끝나면 쌓아 둔 기간을 받은 순서대로 이어서 시작한다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store({ status: "EXPIRED" })],
        premiumGrants: [
          grant({
            id: "later",
            status: "BANKED",
            endsAt: null,
            createdAt: new Date("2028-02-22T00:00:00.000Z"),
          }),
          grant({
            id: "earlier",
            status: "BANKED",
            endsAt: null,
            durationDays: 3,
            createdAt: new Date("2028-02-21T00:00:00.000Z"),
          }),
        ],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan).toEqual({
        activations: [
          { grantId: "earlier", startsAt: NOW },
          { grantId: "later", startsAt: new Date("2028-02-29T12:00:00.000Z") },
        ],
        endedGrantIds: [],
      });
    });

    it("스토어 구독이 유효하면 쌓아 둔 기간을 시작하지 않고 끝난 기간만 닫는다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store()],
        premiumGrants: [
          grant({ id: "ended", endsAt: new Date("2028-02-26T12:00:00.000Z") }),
          grant({ id: "banked", status: "BANKED", endsAt: null }),
        ],
      };

      // When
      const plan = PremiumAccessPolicy.planReconciliation(entitlements, NOW);

      // Then
      expect(plan).toEqual({ activations: [], endedGrantIds: ["ended"] });
    });
  });
});
