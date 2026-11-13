import {
  applyStoreEventChain,
  isPremiumGrantActive,
  isStoreEntitlementValid,
  isStoreSubscriptionRenewing,
  resolvePremiumAccess,
  planNewGrantStart,
  planPremiumReconciliation,
  type PremiumGrantTerm,
  premiumGrantDaysOf,
  premiumGrantEndsAt,
  remainingPremiumGrantMs,
  type StoreEntitlement,
} from "./premium-access.domain-service.js";

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

describe("PremiumAccessDomainService", () => {
  describe("premiumGrantEndsAt", () => {
    it("윤년 2028-02-26에서 7일 뒤는 2028-03-04다", () => {
      // Given
      const startsAt = Temporal.Instant.from("2028-02-26T00:00:00.000Z");

      // When
      const endsAt = premiumGrantEndsAt(startsAt, 7);

      // Then
      expect(endsAt).toEqual(Temporal.Instant.from("2028-03-04T00:00:00.000Z"));
    });

    it("미국 서머타임이 시작되는 주(2028-03-12)를 지나도 7일은 정확히 168시간이다", () => {
      // Given
      const startsAt = Temporal.Instant.from("2028-03-10T08:00:00.000Z");

      // When
      const endsAt = premiumGrantEndsAt(startsAt, 7);

      // Then
      expect(endsAt.epochMilliseconds - startsAt.epochMilliseconds).toBe(7 * 24 * 60 * 60 * 1000);
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
        const subscription = store({ status, expiresAt: Temporal.Instant.from(expiresAt) });

        // When
        const result = isStoreEntitlementValid(subscription, NOW);

        // Then
        expect(result).toBe(expected);
      },
    );
  });

  describe("결제 유예(billing grace)", () => {
    const EXPIRED_AT = Temporal.Instant.from("2028-02-20T00:00:00.000Z");
    const GRACE_ENDS_AT = Temporal.Instant.from("2028-03-07T00:00:00.000Z");

    it.each([
      { status: "ACTIVE" as const, expected: true },
      // 결제가 실패하면 공급자는 결제 문제와 해지(BILLING_ERROR)를 함께 알린다
      { status: "CANCELLED" as const, expected: true },
      { status: "EXPIRED" as const, expected: false },
    ])(
      "만료 6일 뒤에도 유예가 남은 $status 구독은 $expected를 반환한다",
      ({ status, expected }) => {
        // Given
        const subscription = store({
          status,
          expiresAt: EXPIRED_AT,
          gracePeriodEndsAt: GRACE_ENDS_AT,
        });

        // When
        const result = isStoreEntitlementValid(subscription, NOW);

        // Then
        expect(result).toBe(expected);
      },
    );

    it("유예 10일째에는 스토어 출처를 유지하고 쌓아 둔 보상을 시작하지 않는다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store({ expiresAt: EXPIRED_AT, gracePeriodEndsAt: GRACE_ENDS_AT })],
        premiumGrants: [banked("grant-banked", "2028-02-01T00:00:00.000Z")],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);
      const plan = planPremiumReconciliation(entitlements, NOW);

      // Then
      expect(access).toMatchObject({
        source: "STORE",
        periodEndsAt: GRACE_ENDS_AT,
        endsAt: Temporal.Instant.from("2028-03-14T00:00:00.000Z"),
        bankedDays: 7,
      });
      expect(plan.activations).toEqual([]);
    });

    it("유예가 끝나면 쌓아 둔 보상을 유예 끝 시각부터 이어 시작한다", () => {
      // Given
      const afterGrace = Temporal.Instant.from("2028-03-07T00:10:00.000Z");
      const entitlements = {
        storeSubscriptions: [store({ expiresAt: EXPIRED_AT, gracePeriodEndsAt: GRACE_ENDS_AT })],
        premiumGrants: [banked("grant-banked", "2028-02-01T00:00:00.000Z")],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, afterGrace);

      // Then
      expect(plan.activations).toEqual([{ grantId: "grant-banked", startsAt: GRACE_ENDS_AT }]);
    });
  });

  describe("applyStoreEventChain", () => {
    const stored = {
      storeSubscriptionId: "chain-1",
      productId: "com.aido.pro.yearly",
      startedAt: Temporal.Instant.from("2027-03-10T00:00:00.000Z"),
      status: "CANCELLED" as const,
      expiresAt: Temporal.Instant.from("2028-03-10T00:00:00.000Z"),
      gracePeriodEndsAt: Temporal.Instant.from("2028-03-20T00:00:00.000Z"),
    };

    it("만료 시각이 없는 이벤트는 저장된 만료 시각과 결제 유예를 유지한다", () => {
      // Given
      const eventChain = { storeSubscriptionId: "chain-1", status: "ACTIVE" as const };

      // When
      const applied = applyStoreEventChain([stored], eventChain);

      // Then
      expect(applied).toEqual([
        {
          storeSubscriptionId: "chain-1",
          productId: "com.aido.pro.yearly",
          startedAt: stored.startedAt,
          status: "ACTIVE",
          expiresAt: stored.expiresAt,
          gracePeriodEndsAt: stored.gracePeriodEndsAt,
          periodType: null,
        },
      ]);
    });

    it("만료 시각이 null이면 체인의 엔타이틀먼트가 없다", () => {
      // Given
      const eventChain = {
        storeSubscriptionId: "chain-1",
        status: "FREE" as const,
        expiresAt: null,
      };

      // When
      const applied = applyStoreEventChain([stored], eventChain);

      // Then
      expect(applied).toEqual([]);
    });
  });

  describe("resolve", () => {
    it("예전에 스토어와 겹쳐 시작한 기간이 남아 있으면 그 끝까지 스토어 출처로 본다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({
            status: "CANCELLED",
            expiresAt: Temporal.Instant.from("2028-02-28T00:00:00.000Z"),
          }),
        ],
        premiumGrants: [grant({ endsAt: Temporal.Instant.from("2028-03-04T00:00:00.000Z") })],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "STORE",
        endsAt: Temporal.Instant.from("2028-03-04T00:00:00.000Z"),
        periodEndsAt: Temporal.Instant.from("2028-03-04T00:00:00.000Z"),
        willRenew: false,
        bankedDays: 0,
        recentGrantEndedAt: null,
        isTrial: false,
        planType: "ANNUAL",
      });
    });

    it("Play에서 연간→월간으로 바꿔 새 체인이 생기면 지금 기간·갱신·요금제는 새 체인, 프리미엄 끝은 옛 체인 만료까지다", () => {
      // Given
      const annualEndsAt = Temporal.Instant.from("2028-12-01T00:00:00.000Z");
      const monthlyEndsAt = Temporal.Instant.from("2028-03-26T12:00:00.000Z");
      const entitlements = {
        storeSubscriptions: [
          store({
            productId: "com.aido.pro.yearly:yearly-base",
            startedAt: Temporal.Instant.from("2027-12-01T00:00:00.000Z"),
            expiresAt: annualEndsAt,
          }),
          store({
            productId: "com.aido.pro.monthly:monthly-base",
            startedAt: NOW,
            status: "CANCELLED",
            expiresAt: monthlyEndsAt,
          }),
        ],
        premiumGrants: [],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toMatchObject({
        source: "STORE",
        planType: "MONTHLY",
        periodEndsAt: monthlyEndsAt,
        willRenew: false,
        endsAt: annualEndsAt,
      });
    });

    it("스토어 구독이 만료돼도 진행 중인 보상 기간으로 프리미엄을 유지한다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({
            status: "EXPIRED",
            expiresAt: Temporal.Instant.from("2028-02-26T00:00:00.000Z"),
          }),
        ],
        premiumGrants: [grant()],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "GRANT",
        endsAt: Temporal.Instant.from("2028-03-01T00:00:00.000Z"),
        periodEndsAt: Temporal.Instant.from("2028-03-01T00:00:00.000Z"),
        willRenew: false,
        bankedDays: 0,
        recentGrantEndedAt: null,
        isTrial: false,
        planType: null,
      });
    });

    it("보상 기간 중 또 받은 보상은 지금 기간 끝과 이어 붙인 전체 끝, 대기 일수로 따로 보인다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [grant(), banked("next", "2028-02-25T00:00:00.000Z")],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "GRANT",
        endsAt: Temporal.Instant.from("2028-03-08T00:00:00.000Z"),
        periodEndsAt: Temporal.Instant.from("2028-03-01T00:00:00.000Z"),
        willRenew: false,
        bankedDays: 7,
        recentGrantEndedAt: null,
        isTrial: false,
        planType: null,
      });
    });

    it("시작하지 않은 쌓아 둔 기간만 있으면 아직 프리미엄이 아니다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [banked("banked", "2028-02-25T00:00:00.000Z")],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: null,
        endsAt: null,
        periodEndsAt: null,
        willRenew: false,
        bankedDays: 7,
        recentGrantEndedAt: null,
        isTrial: false,
        planType: null,
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
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "STORE",
        endsAt: Temporal.Instant.from("2028-03-31T03:00:00.000Z"),
        periodEndsAt: Temporal.Instant.from("2028-03-10T00:00:00.000Z"),
        willRenew: true,
        bankedDays: 21,
        recentGrantEndedAt: null,
        isTrial: false,
        planType: "ANNUAL",
      });
    });

    it("취소한 구독 뒤의 보상은 스토어 만료 시각부터 빈틈 없이 이어 붙인다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store({ status: "CANCELLED" })],
        premiumGrants: [banked("banked", "2028-02-21T00:00:00.000Z")],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "STORE",
        endsAt: Temporal.Instant.from("2028-03-17T00:00:00.000Z"),
        periodEndsAt: Temporal.Instant.from("2028-03-10T00:00:00.000Z"),
        willRenew: false,
        bankedDays: 7,
        recentGrantEndedAt: null,
        isTrial: false,
        planType: "ANNUAL",
      });
    });

    it("갱신 웹훅을 기다리는 유예 시간에는 만료 시각이 지나도 스토어 출처로 갱신 예정이다", () => {
      // Given
      const expiresAt = Temporal.Instant.from("2028-02-26T11:00:00.000Z");
      const entitlements = {
        storeSubscriptions: [store({ expiresAt })],
        premiumGrants: [banked("banked", "2028-02-21T00:00:00.000Z")],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toEqual({
        source: "STORE",
        endsAt: Temporal.Instant.from("2028-03-04T14:00:00.000Z"),
        periodEndsAt: expiresAt,
        willRenew: true,
        bankedDays: 7,
        recentGrantEndedAt: null,
        isTrial: false,
        planType: "ANNUAL",
      });
    });

    it("2028-02-29에 산 연간 구독은 저장된 만료 시각 그대로 보상을 잇는다", () => {
      // Given
      const now = Temporal.Instant.from("2028-02-29T12:00:00.000Z");
      const storedExpiresAt = Temporal.Instant.from("2029-02-28T12:00:00.000Z");
      const entitlements = {
        storeSubscriptions: [store({ status: "CANCELLED", expiresAt: storedExpiresAt })],
        premiumGrants: [banked("banked", "2028-02-29T12:00:00.000Z")],
      };

      // When
      const access = resolvePremiumAccess(entitlements, now);

      // Then
      expect(access).toMatchObject({
        source: "STORE",
        periodEndsAt: storedExpiresAt,
        endsAt: Temporal.Instant.from("2029-03-07T12:00:00.000Z"),
      });
    });

    it.each([
      { expiresAt: "2028-02-26T12:00:00.001Z", source: "STORE" },
      { expiresAt: "2028-02-26T12:00:00.000Z", source: null },
    ])("취소한 구독이 $expiresAt에 끝나면 지금 출처는 $source다", ({ expiresAt, source }) => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({ status: "CANCELLED", expiresAt: Temporal.Instant.from(expiresAt) }),
        ],
        premiumGrants: [banked("banked", "2028-02-21T00:00:00.000Z")],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access.source).toBe(source);
      expect(access.bankedDays).toBe(7);
    });
  });

  describe("무료 체험 (STORE + periodType TRIAL)", () => {
    const TRIAL_ENDS = Temporal.Instant.from("2028-02-29T00:00:00.000Z");

    it("체험 중이면 출처는 STORE이고 isTrial이며 기간 끝은 스토어 만료 시각 그대로다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store({ expiresAt: TRIAL_ENDS, periodType: "TRIAL" })],
        premiumGrants: [],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toMatchObject({
        source: "STORE",
        isTrial: true,
        willRenew: true,
        periodEndsAt: TRIAL_ENDS,
      });
    });

    it.each([
      // 체험 길이(2주·1주·이미 받은 1개월)는 스토어가 정하고 서버는 다시 계산하지 않는다
      { name: "윤년 2/29", expiresAt: "2028-02-29T09:15:00.000Z" },
      { name: "평년 월말 2/28", expiresAt: "2027-02-28T09:15:00.000Z" },
    ])("$name: 체험 끝은 스토어 expiration_at_ms 그대로다", ({ expiresAt }) => {
      // Given
      const ends = Temporal.Instant.from(expiresAt);
      const now = ends.subtract({ milliseconds: 60_000 });
      const entitlements = {
        storeSubscriptions: [store({ expiresAt: ends, periodType: "TRIAL" })],
        premiumGrants: [],
      };

      // When
      const access = resolvePremiumAccess(entitlements, now);

      // Then
      expect(access.periodEndsAt).toEqual(ends);
      expect(access.endsAt).toEqual(ends);
    });

    it("체험 중 받은 보상은 쌓아 두고 체험(자동 갱신 대기 3시간)이 끝난 뒤부터 이어 붙인다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [store({ expiresAt: TRIAL_ENDS, periodType: "TRIAL" })],
        premiumGrants: [banked("invite", "2028-02-20T00:00:00.000Z")],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toMatchObject({
        source: "STORE",
        isTrial: true,
        bankedDays: 7,
        periodEndsAt: TRIAL_ENDS,
        endsAt: Temporal.Instant.from("2028-03-07T03:00:00.000Z"),
      });
    });

    it("체험을 해지하면 체험 끝에서 바로 쌓아 둔 보상이 이어진다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({ status: "CANCELLED", expiresAt: TRIAL_ENDS, periodType: "TRIAL" }),
        ],
        premiumGrants: [banked("invite", "2028-02-20T00:00:00.000Z")],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toMatchObject({
        source: "STORE",
        isTrial: true,
        willRenew: false,
        endsAt: Temporal.Instant.from("2028-03-07T00:00:00.000Z"),
      });
    });

    it("해지한 체험이 끝난 뒤 정리하면 보상은 체험이 끝난 시각부터 시작하고 체험이 아니다", () => {
      // Given
      const afterTrial = Temporal.Instant.from("2028-02-29T00:10:00.000Z");
      const entitlements = {
        storeSubscriptions: [
          store({ status: "CANCELLED", expiresAt: TRIAL_ENDS, periodType: "TRIAL" }),
        ],
        premiumGrants: [banked("invite", "2028-02-20T00:00:00.000Z")],
      };

      // When
      const plan = planPremiumReconciliation(entitlements, afterTrial);
      const access = resolvePremiumAccess(
        {
          ...entitlements,
          premiumGrants: [
            grant({
              id: "invite",
              startsAt: TRIAL_ENDS,
              endsAt: Temporal.Instant.from("2028-03-07T00:00:00.000Z"),
            }),
          ],
        },
        afterTrial,
      );

      // Then
      expect(plan.activations).toEqual([{ grantId: "invite", startsAt: TRIAL_ENDS }]);
      expect(access).toMatchObject({ source: "GRANT", isTrial: false });
    });

    it("체험이 결제로 넘어가 NORMAL이 되면 체험이 아니다", () => {
      // Given
      const entitlements = {
        storeSubscriptions: [
          store({
            expiresAt: Temporal.Instant.from("2029-02-28T00:00:00.000Z"),
            periodType: "NORMAL",
          }),
        ],
        premiumGrants: [],
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access.isTrial).toBe(false);
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
          lastEndedGrantAt: Temporal.Instant.from(endedAt),
        };

        // When
        const access = resolvePremiumAccess(entitlements, NOW);

        // Then
        expect(access.recentGrantEndedAt).toEqual(
          expected == null ? null : Temporal.Instant.from(expected),
        );
      },
    );

    it("정리 전에 끝난 ACTIVE 기간도 끝난 보상으로 본다", () => {
      // Given
      const endedAt = Temporal.Instant.from("2028-02-26T11:59:59.999Z");
      const entitlements = {
        storeSubscriptions: [],
        premiumGrants: [grant({ endsAt: endedAt })],
        lastEndedGrantAt: Temporal.Instant.from("2028-02-20T00:00:00.000Z"),
      };

      // When
      const access = resolvePremiumAccess(entitlements, NOW);

      // Then
      expect(access).toMatchObject({ source: null, recentGrantEndedAt: endedAt });
    });

    it("지금 스토어나 보상으로 프리미엄이면 끝난 보상을 알리지 않는다", () => {
      // Given
      const lastEndedGrantAt = Temporal.Instant.from("2028-02-26T00:00:00.000Z");
      const subscribed = { storeSubscriptions: [store()], premiumGrants: [], lastEndedGrantAt };
      const granted = { storeSubscriptions: [], premiumGrants: [grant()], lastEndedGrantAt };

      // When
      const accesses = [subscribed, granted].map((entitlements) =>
        resolvePremiumAccess(entitlements, NOW),
      );

      // Then
      expect(accesses.map((access) => access.recentGrantEndedAt)).toEqual([null, null]);
    });
  });

  describe("remainingPremiumGrantMs", () => {
    it.each([
      { endsAt: "2028-02-26T12:00:00.000Z", expected: 0 },
      { endsAt: "2028-02-26T12:00:00.001Z", expected: 1 },
      { endsAt: "2028-02-28T12:00:00.001Z", expected: 2 * 24 * 60 * 60 * 1000 + 1 },
      // 윤일 2028-02-29를 지나도 하루는 24시간이다
      { endsAt: "2028-03-02T12:00:00.000Z", expected: 5 * 24 * 60 * 60 * 1000 },
    ])("$endsAt에 끝나는 기간을 지금 끊으면 $expected ms가 남는다", ({ endsAt, expected }) => {
      // Given
      const current = grant({ endsAt: Temporal.Instant.from(endsAt) });

      // When
      const remainingMs = remainingPremiumGrantMs(current, NOW);

      // Then
      expect(remainingMs).toBe(expected);
    });

    it.each([
      { remainingMs: 1, expected: 1 },
      { remainingMs: 2 * 24 * 60 * 60 * 1000, expected: 2 },
      { remainingMs: 2 * 24 * 60 * 60 * 1000 + 1, expected: 3 },
    ])("남은 $remainingMs ms는 표시 일수 $expected일로 올린다", ({ remainingMs, expected }) => {
      // Given / When
      const days = premiumGrantDaysOf(remainingMs);

      // Then
      expect(days).toBe(expected);
    });
  });

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
