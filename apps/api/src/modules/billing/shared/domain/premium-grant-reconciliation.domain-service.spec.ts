import {
  type PremiumGrantTerm,
  premiumGrantEndsAt,
  type StoreEntitlement,
} from "./premium-access.domain-service.js";
import {
  planNewGrantStart,
  planPremiumReconciliation,
} from "./premium-grant-reconciliation.domain-service.js";

const NOW = Temporal.Instant.from("2028-02-26T12:00:00.000Z");

function grant(overrides: Partial<PremiumGrantTerm> = {}): PremiumGrantTerm {
  return {
    id: "grant-1",
    status: "ACTIVE",
    durationDays: 7,
    startsAt: Temporal.Instant.from("2028-02-23T00:00:00.000Z"),
    endsAt: Temporal.Instant.from("2028-03-01T00:00:00.000Z"),
    createdAt: Temporal.Instant.from("2028-02-20T00:00:00.000Z"),
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
    createdAt: Temporal.Instant.from(createdAt),
  });
}

function store(overrides: Partial<StoreEntitlement> = {}): StoreEntitlement {
  return {
    productId: "com.aido.pro.yearly",
    startedAt: Temporal.Instant.from("2027-03-10T00:00:00.000Z"),
    status: "ACTIVE",
    expiresAt: Temporal.Instant.from("2028-03-10T00:00:00.000Z"),
    ...overrides,
  };
}

describe("PremiumGrantReconciliationDomainService", () => {
  describe("planNewGrantStart", () => {
    it("자동 갱신 중인 스토어 구독이 있으면 새 보상을 쌓아 둔다", () => {
      // Given
      const entitlements = { storeSubscriptions: [store()], premiumGrants: [] };

      // When
      const start = planNewGrantStart(entitlements, NOW);

      // Then
      expect(start).toEqual({ kind: "bank" });
    });

    it("진행 중인 보상이 있으면 미래 시작 기간을 만들지 않고 쌓아 둔다", () => {
      // Given
      const entitlements = { storeSubscriptions: [], premiumGrants: [grant()] };

      // When
      const start = planNewGrantStart(entitlements, NOW);

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
      const start = planNewGrantStart(entitlements, NOW);

      // Then
      expect(start).toEqual({ kind: "activate", startsAt: NOW });
    });
  });

  describe("planReconciliation", () => {
    it("환불로 스토어 엔타이틀먼트가 끝나면 먼저 받은 기간 하나만 지금 시작하고 나머지는 쌓아 둔다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({
            status: "EXPIRED",
            expiresAt: Temporal.Instant.from("2028-03-10T00:00:00.000Z"),
          }),
        ],
        premiumGrants: [
          banked("later", "2028-02-22T00:00:00.000Z"),
          banked("earlier", "2028-02-21T00:00:00.000Z", 3),
        ],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, NOW);

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
      const previousEndsAt = Temporal.Instant.from("2028-02-26T11:55:00.000Z");
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [
          grant({ id: "previous", endsAt: previousEndsAt }),
          banked("next", "2028-02-25T00:00:00.000Z"),
        ],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, NOW);

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
      const previousEndsAt = Temporal.Instant.from("2028-02-29T15:00:00.000Z");
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [
          grant({ id: "previous", endsAt: previousEndsAt }),
          banked("next", "2028-02-25T00:00:00.000Z"),
        ],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, previousEndsAt);
      const endsAt = premiumGrantEndsAt(previousEndsAt, 7);

      // Then
      expect(plan.activations).toEqual([{ grantId: "next", startsAt: previousEndsAt }]);
      expect(plan.endedGrantIds).toEqual(["previous"]);
      expect(endsAt).toEqual(Temporal.Instant.from("2028-03-07T15:00:00.000Z"));
    });

    it("앞 기간이 끝난 뒤 스토어가 유효했으면 스토어가 끝난 시각부터 잇는다", () => {
      // Given
      const storeLapsedAt = Temporal.Instant.from("2028-02-26T11:30:00.000Z");
      const entitlements = {
        storeSubscriptions: [store({ status: "EXPIRED", expiresAt: storeLapsedAt })],
        premiumGrants: [
          grant({ id: "previous", endsAt: Temporal.Instant.from("2028-02-26T10:00:00.000Z") }),
          banked("next", "2028-02-25T00:00:00.000Z"),
        ],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, NOW);

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
            store({
              status: subscription.status,
              expiresAt: Temporal.Instant.from(subscription.expiresAt),
            }),
          ],
          premiumGrants: [banked("banked", "2028-02-21T00:00:00.000Z")],
        };

        // When
        const plan = planPremiumReconciliation(entitlements, NOW);

        // Then
        expect(plan.activations).toEqual([
          { grantId: "banked", startsAt: Temporal.Instant.from(startsAt) },
        ]);
      },
    );

    it("쌓아 둔 기간을 받기 전에 끝난 스토어에는 이어 붙이지 않고 지금 시작한다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({
            status: "EXPIRED",
            expiresAt: Temporal.Instant.from("2028-02-20T00:00:00.000Z"),
          }),
        ],
        premiumGrants: [banked("banked", "2028-02-25T00:00:00.000Z")],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, NOW);

      // Then
      expect(plan.activations).toEqual([{ grantId: "banked", startsAt: NOW }]);
    });

    it("정리가 오래 밀렸으면 그동안 끝났어야 할 기간은 시작과 함께 끝내고 다음 기간을 잇는다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [
          grant({ id: "previous", endsAt: Temporal.Instant.from("2028-02-24T12:00:00.000Z") }),
          banked("short", "2028-02-20T00:00:00.000Z", 1),
          banked("long", "2028-02-21T00:00:00.000Z", 7),
        ],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, NOW);

      // Then
      expect(plan).toEqual({
        rebankedGrantIds: [],
        splitGrantIds: [],
        activations: [
          { grantId: "short", startsAt: Temporal.Instant.from("2028-02-24T12:00:00.000Z") },
          { grantId: "long", startsAt: Temporal.Instant.from("2028-02-25T12:00:00.000Z") },
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
      const plan = planPremiumReconciliation(entitlements, NOW);

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
          grant({ id: "ended", endsAt: Temporal.Instant.from("2028-02-26T12:00:00.000Z") }),
          banked("banked", "2028-02-25T00:00:00.000Z"),
        ],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, NOW);

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
        storeSubscriptions: [
          store({ expiresAt: Temporal.Instant.from("2028-02-26T09:30:00.000Z") }),
        ],
        premiumGrants: [banked("banked", "2028-02-25T00:00:00.000Z")],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, NOW);

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
            startsAt: Temporal.Instant.from("2028-03-01T00:00:00.000Z"),
            endsAt: Temporal.Instant.from("2028-03-08T00:00:00.000Z"),
          }),
        ],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, NOW);

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
          premiumGrants: [grant({ id: "current", endsAt: Temporal.Instant.from(endsAt) })],
        };

        // When
        const plan = planPremiumReconciliation(entitlements, NOW);

        // Then
        expect(plan.splitGrantIds).toEqual(split);
        expect(plan.endedGrantIds).toEqual(ended);
      },
    );
  });
});
