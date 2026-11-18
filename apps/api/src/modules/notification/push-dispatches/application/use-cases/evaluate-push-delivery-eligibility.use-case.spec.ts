import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryUserNotificationSettings } from "#test/doubles/notification/in-memory-user-notification-settings";
import { StubNotificationRecipientPreferenceReader } from "#test/doubles/notification/stub-notification-recipient-preference.reader";
import { StubPushRateLimiter } from "#test/doubles/notification/stub-push-rate-limiter";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createNotificationDeliveryPreferenceFixture } from "#test/fixtures/notification/notification-delivery-preference.fixture";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";

import { createSnoozedReminderMetadata } from "../../../shared/domain/reminder-occurrence.domain-service.js";
import { PushDispatchId } from "../../domain/push-dispatch-id.vo.js";
import { EvaluateBatchPushDeliverySettingsUseCase } from "./evaluate-batch-push-delivery-settings.use-case.js";
import { EvaluatePushDeliveryEligibilityUseCase } from "./evaluate-push-delivery-eligibility.use-case.js";
import { LoadPushDeliveryRecipientUseCase } from "./load-push-delivery-recipient.use-case.js";
import { LoadPushDeliveryRecipientsUseCase } from "./load-push-delivery-recipients.use-case.js";
import { ReserveBatchPushRateLimitsUseCase } from "./reserve-batch-push-rate-limits.use-case.js";

const DAYTIME = Temporal.Instant.from("2026-07-16T03:00:00.000Z");
const KST_NIGHT = Temporal.Instant.from("2026-07-16T14:00:00.000Z");
const RATE_LIMIT_DISPATCH_ID = 101;

const transactional = createNotificationDraftFixture({
  userId: "user-1",
  type: "FOLLOW_NEW",
  title: "title",
  body: "body",
});

const engagement = createNotificationDraftFixture({
  ...transactional,
  type: "LUNCH_NUDGE",
  purpose: "ENGAGEMENT",
});

const MARKETING_AGREED_AT = Temporal.Instant.from("2026-07-01T00:00:00Z");

function localInstant(timeZone: string, localTime: string): Temporal.Instant {
  return Temporal.PlainDate.from("2026-07-16")
    .toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from(localTime) })
    .toInstant();
}

function createEvaluatePushDeliveryEligibilityUseCase(now: Temporal.Instant = DAYTIME) {
  const userSettings = new InMemoryUserNotificationSettings();
  const rateLimiter = new StubPushRateLimiter();
  const recipientPreferenceReader = new StubNotificationRecipientPreferenceReader();
  const clock = new FixedClock(now);
  const useCase = {
    loadRecipient: new LoadPushDeliveryRecipientUseCase({ recipientPreferenceReader, clock }),
    loadRecipients: new LoadPushDeliveryRecipientsUseCase({ userSettings, clock }),
    evaluateEligibility: new EvaluatePushDeliveryEligibilityUseCase({
      userSettings,
      rateLimiter,
      clock,
    }),
    evaluateSettings: new EvaluateBatchPushDeliverySettingsUseCase({ clock }),
    reserveRateLimits: new ReserveBatchPushRateLimitsUseCase({ rateLimiter, clock }),
  };
  return { useCase, userSettings, rateLimiter, recipientPreferenceReader };
}

describe("푸시 수신자 읽기·발송 자격 판정·배치 빈도 예약", () => {
  it("단건 수신자 컨텍스트는 미상 UTC를 배송용 KST와 현지 날짜로 보정한다", async () => {
    // Given
    const { useCase, recipientPreferenceReader } = createEvaluatePushDeliveryEligibilityUseCase();
    recipientPreferenceReader.preferences.set(
      "user-1",
      createNotificationDeliveryPreferenceFixture({ timezone: "UTC" }),
    );

    // When
    const recipient = useCase.loadRecipient.execute("user-1");

    // Then
    await expect(recipient).resolves.toMatchObject({
      userId: "user-1",
      timezone: "Asia/Seoul",
      localDate: "2026-07-16",
    });
  });

  it("단건은 push 비활성 설정을 가장 먼저 거부하고 rate counter를 소비하지 않는다", async () => {
    // Given
    const { useCase, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
    const recipient = {
      ...(await useCase.loadRecipient.execute("user-1")),
      preference: createNotificationDeliveryPreferenceFixture({ pushEnabled: false }),
    };

    // When
    const decision = useCase.evaluateEligibility.execute({
      data: transactional,
      recipient: recipient,
      rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
      hasReservedRateLimit: false,
    });

    // Then
    await expect(decision).resolves.toEqual({
      status: "skipped",
      candidate: transactional,
      reason: "PUSH_DISABLED",
    });
    expect(rateLimiter.reservationCount).toBe(0);
  });

  it("단건은 일반 rate 제한을 야간·마케팅 동의 조회보다 먼저 판정한다", async () => {
    // Given
    const { useCase, rateLimiter, userSettings } = createEvaluatePushDeliveryEligibilityUseCase();
    rateLimiter.limitedGeneralUserIds.add("user-1");
    const recipient = await useCase.loadRecipient.execute("user-1");

    // When
    const decision = useCase.evaluateEligibility.execute({
      data: engagement,
      recipient: recipient,
      rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
      hasReservedRateLimit: false,
    });

    // Then
    await expect(decision).resolves.toMatchObject({ status: "skipped", reason: "RATE_LIMITED" });
    expect(userSettings.consentReadUserIds).toEqual([]);
    expect(rateLimiter.engagementRequests).toEqual([]);
  });

  it("단건 마케팅은 야간 quiet-hours를 동의 조회보다 앞서 적용한다", async () => {
    // Given
    const { useCase, userSettings } = createEvaluatePushDeliveryEligibilityUseCase(KST_NIGHT);
    const recipient = await useCase.loadRecipient.execute("user-1");

    // When
    const decision = useCase.evaluateEligibility.execute({
      data: engagement,
      recipient: recipient,
      rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
      hasReservedRateLimit: false,
    });

    // Then
    await expect(decision).resolves.toMatchObject({
      status: "skipped",
      reason: "MARKETING_QUIET_HOURS",
    });
    expect(userSettings.consentReadUserIds).toEqual([]);
  });

  it("단건 참여 유도는 동의 후 현지 날짜 engagement 제한을 별도로 판정한다", async () => {
    // Given
    const { useCase, userSettings, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
    userSettings.consents.set("user-1", {
      marketingPushAgreedAt: Temporal.Instant.from("2026-07-01T00:00:00Z"),
    });
    rateLimiter.limitedEngagementUserIds.add("user-1");
    const recipient = await useCase.loadRecipient.execute("user-1");

    // When
    const decision = useCase.evaluateEligibility.execute({
      data: engagement,
      recipient: recipient,
      rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
      hasReservedRateLimit: false,
    });

    // Then
    await expect(decision).resolves.toMatchObject({
      status: "skipped",
      reason: "ENGAGEMENT_RATE_LIMITED",
    });
    expect(rateLimiter.engagementRequests).toEqual([
      {
        dispatchId: PushDispatchId.reconstitute(RATE_LIMIT_DISPATCH_ID),
        userId: UserId.reconstitute("user-1"),
        localDate: "2026-07-16",
      },
    ]);
  });

  it("재시도는 저장된 rate 예약을 재사용해도 현재 push 비활성 설정을 즉시 반영한다", async () => {
    // Given
    const { useCase, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
    const recipient = {
      ...(await useCase.loadRecipient.execute("user-1")),
      preference: createNotificationDeliveryPreferenceFixture({ pushEnabled: false }),
    };

    // When
    const decision = useCase.evaluateEligibility.execute({
      data: transactional,
      recipient: recipient,
      rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
      hasReservedRateLimit: true,
    });

    // Then
    await expect(decision).resolves.toMatchObject({ status: "skipped", reason: "PUSH_DISABLED" });
    expect(rateLimiter.reservationCount).toBe(0);
  });

  it("재시도는 rate counter를 다시 쓰지 않고 철회된 marketing consent를 반영한다", async () => {
    // Given
    const { useCase, userSettings, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
    userSettings.consents.set("user-1", { marketingPushAgreedAt: null });
    const recipient = await useCase.loadRecipient.execute("user-1");

    // When
    const decision = useCase.evaluateEligibility.execute({
      data: engagement,
      recipient: recipient,
      rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
      hasReservedRateLimit: true,
    });

    // Then
    await expect(decision).resolves.toMatchObject({
      status: "skipped",
      reason: "MARKETING_CONSENT_REQUIRED",
    });
    expect(rateLimiter.reservationCount).toBe(0);
  });

  it("재시도 시 quiet-hours로 전환되면 저장된 rate 예약과 무관하게 마케팅을 중단한다", async () => {
    // Given
    const { useCase, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase(KST_NIGHT);
    const recipient = await useCase.loadRecipient.execute("user-1");

    // When
    const decision = useCase.evaluateEligibility.execute({
      data: engagement,
      recipient: recipient,
      rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
      hasReservedRateLimit: true,
    });

    // Then
    await expect(decision).resolves.toMatchObject({
      status: "skipped",
      reason: "MARKETING_QUIET_HOURS",
    });
    expect(rateLimiter.reservationCount).toBe(0);
  });

  it("배치는 설정·동의를 한 번씩 bulk 조회하고 설정 행 부재를 명시적으로 보존한다", async () => {
    // Given
    const { useCase, userSettings } = createEvaluatePushDeliveryEligibilityUseCase();
    userSettings.preferences.set("user-1", createNotificationDeliveryPreferenceFixture());

    // When
    const recipients = await useCase.loadRecipients.execute(["user-1", "user-2", "user-1"]);

    // Then
    expect(userSettings.preferenceBatchReads).toEqual([["user-1", "user-2"]]);
    expect(userSettings.consentBatchReads).toEqual([["user-1", "user-2"]]);
    expect(recipients.get("user-2")).toMatchObject({
      preference: undefined,
      timezone: "Asia/Seoul",
    });
  });

  it("배치 설정 판정은 force 비마케팅만 우회하고 마케팅 동의와 설정 부재 이유를 구분한다", async () => {
    // Given
    const { useCase, userSettings } = createEvaluatePushDeliveryEligibilityUseCase();
    userSettings.preferences.set("marketing", createNotificationDeliveryPreferenceFixture());
    const recipients = await useCase.loadRecipients.execute(["forced", "missing", "marketing"]);
    const forced = {
      data: { ...transactional, userId: "forced", type: "ADMIN_BROADCAST" as const, force: true },
      rateLimitDispatchId: 1,
    };
    const missing = { data: { ...transactional, userId: "missing" }, rateLimitDispatchId: 2 };
    const marketing = { data: { ...engagement, userId: "marketing" }, rateLimitDispatchId: 3 };

    // When
    const decisions = useCase.evaluateSettings.execute({
      candidates: [forced, missing, marketing],
      recipients: recipients,
    });

    // Then
    expect(decisions).toEqual([
      { status: "eligible", candidate: forced, ttlSeconds: 86_400 },
      { status: "skipped", candidate: missing, reason: "PUSH_SETTINGS_MISSING" },
      { status: "skipped", candidate: marketing, reason: "MARKETING_CONSENT_REQUIRED" },
    ]);
  });

  it("배치 rate 예약은 입력 순서·현지 날짜를 보존하고 모든 제한을 RATE_LIMITED로 정규화한다", async () => {
    // Given
    const { useCase, userSettings, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
    userSettings.preferences.set("user-1", createNotificationDeliveryPreferenceFixture());
    userSettings.preferences.set(
      "user-2",
      createNotificationDeliveryPreferenceFixture({ timezone: "America/New_York" }),
    );
    rateLimiter.limitedBatchUserIds.add("user-2");
    const recipients = await useCase.loadRecipients.execute(["user-1", "user-2"]);
    const first = { data: engagement, rateLimitDispatchId: 1 };
    const second = { data: { ...engagement, userId: "user-2" }, rateLimitDispatchId: 2 };

    // When
    const decisions = await useCase.reserveRateLimits.execute({
      candidates: [first, second],
      recipients: recipients,
    });

    // Then
    expect(decisions).toEqual([
      { status: "eligible", candidate: first },
      { status: "skipped", candidate: second, reason: "RATE_LIMITED" },
    ]);
    expect(rateLimiter.batchRequests).toEqual([
      [
        {
          dispatchId: PushDispatchId.reconstitute(1),
          userId: UserId.reconstitute("user-1"),
          engagementLocalDate: "2026-07-16",
        },
        {
          dispatchId: PushDispatchId.reconstitute(2),
          userId: UserId.reconstitute("user-2"),
          engagementLocalDate: "2026-07-15",
        },
      ],
    ]);
  });

  describe("일반 시간당 한도 — 사용자가 정한 할 일 리마인더는 막지도 세지도 않는다", () => {
    const reminder = { ...transactional, type: "TODO_REMINDER" as const };

    it("단건은 한도에 닿은 사용자에게도 할 일 리마인더를 보내고 소셜 알림은 막는다", async () => {
      // Given
      const { useCase, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
      rateLimiter.limitedGeneralUserIds.add("user-1");
      const recipient = await useCase.loadRecipient.execute("user-1");

      // When
      const decisions = await Promise.all(
        [reminder, transactional].map((data, index) =>
          useCase.evaluateEligibility.execute({
            data: data,
            recipient: recipient,
            rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID + index,
            hasReservedRateLimit: false,
          }),
        ),
      );

      // Then
      expect(decisions).toEqual([
        { status: "eligible", candidate: reminder, ttlSeconds: 3600 },
        { status: "skipped", candidate: transactional, reason: "RATE_LIMITED" },
      ]);
      expect(rateLimiter.generalRequests).toEqual([
        {
          dispatchId: PushDispatchId.reconstitute(RATE_LIMIT_DISPATCH_ID + 1),
          userId: UserId.reconstitute("user-1"),
        },
      ]);
    });

    it("배치는 할 일 리마인더를 예약 요청에서 빼고 나머지의 순서·제한 결과를 지킨다", async () => {
      // Given
      const { useCase, userSettings, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
      userSettings.preferences.set("user-1", createNotificationDeliveryPreferenceFixture());
      userSettings.preferences.set("user-2", createNotificationDeliveryPreferenceFixture());
      rateLimiter.limitedBatchUserIds.add("user-1");
      const recipients = await useCase.loadRecipients.execute(["user-1", "user-2"]);
      const limitedReminder = { data: reminder, rateLimitDispatchId: 1 };
      const limitedSocial = { data: transactional, rateLimitDispatchId: 2 };
      const allowedSocial = {
        data: { ...transactional, userId: "user-2" },
        rateLimitDispatchId: 3,
      };

      // When
      const decisions = await useCase.reserveRateLimits.execute({
        candidates: [limitedReminder, limitedSocial, allowedSocial],
        recipients: recipients,
      });

      // Then
      expect(decisions).toEqual([
        { status: "eligible", candidate: limitedReminder },
        { status: "skipped", candidate: limitedSocial, reason: "RATE_LIMITED" },
        { status: "eligible", candidate: allowedSocial },
      ]);
      expect(rateLimiter.batchRequests).toEqual([
        [
          { dispatchId: PushDispatchId.reconstitute(2), userId: UserId.reconstitute("user-1") },
          { dispatchId: PushDispatchId.reconstitute(3), userId: UserId.reconstitute("user-2") },
        ],
      ]);
    });
  });

  describe("AI 제안·리포트 알림 — 끄면 그 푸시만 건너뛰고 한도를 쓰지 않는다", () => {
    const suggestion = { ...transactional, type: "AI_SUGGESTION" as const };
    const weeklyReport = { ...transactional, type: "WEEKLY_REPORT" as const };

    it("단건은 일반 한도를 예약하기 전에 AI 제안을 건너뛰고 소셜 알림은 보낸다", async () => {
      // Given
      const { useCase, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
      const recipient = {
        ...(await useCase.loadRecipient.execute("user-1")),
        preference: createNotificationDeliveryPreferenceFixture({ aiPushEnabled: false }),
      };

      // When
      const decisions = await Promise.all(
        [suggestion, transactional].map((data, index) =>
          useCase.evaluateEligibility.execute({
            data: data,
            recipient: recipient,
            rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID + index,
            hasReservedRateLimit: false,
          }),
        ),
      );

      // Then
      expect(decisions).toEqual([
        { status: "skipped", candidate: suggestion, reason: "AI_PUSH_DISABLED" },
        { status: "eligible", candidate: transactional, ttlSeconds: 43_200 },
      ]);
      expect(rateLimiter.generalRequests).toEqual([
        {
          dispatchId: PushDispatchId.reconstitute(RATE_LIMIT_DISPATCH_ID + 1),
          userId: UserId.reconstitute("user-1"),
        },
      ]);
    });

    it("배치는 끈 사용자의 리포트만 건너뛰고 켠 사용자의 리포트는 보낸다", async () => {
      // Given
      const { useCase, userSettings } = createEvaluatePushDeliveryEligibilityUseCase();
      userSettings.preferences.set(
        "off",
        createNotificationDeliveryPreferenceFixture({ aiPushEnabled: false }),
      );
      userSettings.preferences.set("on", createNotificationDeliveryPreferenceFixture());
      const recipients = await useCase.loadRecipients.execute(["off", "on"]);
      const offReport = { data: { ...weeklyReport, userId: "off" }, rateLimitDispatchId: 1 };
      const offSocial = { data: { ...transactional, userId: "off" }, rateLimitDispatchId: 2 };
      const onReport = { data: { ...weeklyReport, userId: "on" }, rateLimitDispatchId: 3 };

      // When
      const decisions = useCase.evaluateSettings.execute({
        candidates: [offReport, offSocial, onReport],
        recipients: recipients,
      });

      // Then
      expect(decisions).toEqual([
        { status: "skipped", candidate: offReport, reason: "AI_PUSH_DISABLED" },
        { status: "eligible", candidate: offSocial, ttlSeconds: 43_200 },
        { status: "eligible", candidate: onReport, ttlSeconds: 86_400 },
      ]);
    });
  });

  describe("야간 경계 — 사용자가 정한 리마인더만 야간 수신을 꺼도 보낸다", () => {
    // 21:00까지 1분 미만이면 보관 시간이 0에 가까워 야간처럼 건너뛴다
    it.each([
      ["Asia/Seoul", "20:59", false],
      ["Asia/Seoul", "20:59:30", true],
      ["Asia/Seoul", "21:00", true],
      ["Asia/Seoul", "07:59", true],
      ["Asia/Seoul", "08:00", false],
      ["America/Los_Angeles", "20:59", false],
      ["America/Los_Angeles", "20:59:30", true],
      ["America/Los_Angeles", "21:00", true],
      ["America/Los_Angeles", "07:59", true],
      ["America/Los_Angeles", "08:00", false],
    ] as const)("%s 현지 %s(야간 %s)", async (timeZone, localTime, isNight) => {
      // Given
      const { useCase, userSettings } = createEvaluatePushDeliveryEligibilityUseCase(
        localInstant(timeZone, localTime),
      );
      userSettings.preferences.set(
        "user-1",
        createNotificationDeliveryPreferenceFixture({
          timezone: timeZone,
          nightPushEnabled: false,
        }),
      );
      userSettings.consents.set("user-1", { marketingPushAgreedAt: MARKETING_AGREED_AT });
      const recipients = await useCase.loadRecipients.execute(["user-1"]);
      const candidates = (
        ["TODO_REMINDER", "EVENING_REMINDER", "WEATHER_MORNING", "FOLLOW_NEW", "WINBACK"] as const
      ).map((type, index) => ({ data: { ...transactional, type }, rateLimitDispatchId: index }));

      // When
      const decisions = useCase.evaluateSettings.execute({
        candidates: candidates,
        recipients: recipients,
      });

      // Then
      expect(
        decisions.map((decision) =>
          decision.status === "eligible" ? "eligible" : decision.reason,
        ),
      ).toEqual(
        isNight
          ? ["eligible", "eligible", "eligible", "NIGHT_PUSH_DISABLED", "MARKETING_QUIET_HOURS"]
          : ["eligible", "eligible", "eligible", "eligible", "eligible"],
      );
    });

    it("단건도 야간에 할 일 리마인더는 보내고 소셜 알림은 야간 설정을 따른다", async () => {
      // Given
      const { useCase } = createEvaluatePushDeliveryEligibilityUseCase(
        localInstant("Asia/Seoul", "22:00"),
      );
      const recipient = {
        ...(await useCase.loadRecipient.execute("user-1")),
        preference: createNotificationDeliveryPreferenceFixture({ nightPushEnabled: false }),
      };
      const reminder = { ...transactional, type: "TODO_REMINDER" as const };

      // When
      const decisions = await Promise.all(
        [reminder, transactional].map((data) =>
          useCase.evaluateEligibility.execute({
            data: data,
            recipient: recipient,
            rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
            hasReservedRateLimit: true,
          }),
        ),
      );

      // Then
      expect(decisions).toEqual([
        { status: "eligible", candidate: reminder, ttlSeconds: 3600 },
        { status: "skipped", candidate: transactional, reason: "NIGHT_PUSH_DISABLED" },
      ]);
    });
  });

  describe("보관 시간 — 받는 사람 시간대로 줄인다", () => {
    it("현지 20:15에 광고성과 야간 수신을 끈 사람의 소셜 알림은 21:00까지, 야간 수신을 켠 사람의 소셜 알림은 종류 기본값이다", async () => {
      // Given
      const { useCase, userSettings } = createEvaluatePushDeliveryEligibilityUseCase(
        localInstant("America/Los_Angeles", "20:15"),
      );
      userSettings.preferences.set(
        "night-off",
        createNotificationDeliveryPreferenceFixture({
          timezone: "America/Los_Angeles",
          nightPushEnabled: false,
        }),
      );
      userSettings.preferences.set(
        "night-on",
        createNotificationDeliveryPreferenceFixture({ timezone: "America/Los_Angeles" }),
      );
      userSettings.consents.set("night-on", { marketingPushAgreedAt: MARKETING_AGREED_AT });
      const recipients = await useCase.loadRecipients.execute(["night-off", "night-on"]);
      const candidates = [
        { data: { ...transactional, userId: "night-off" }, rateLimitDispatchId: 1 },
        { data: { ...engagement, userId: "night-on" }, rateLimitDispatchId: 2 },
        { data: { ...transactional, userId: "night-on" }, rateLimitDispatchId: 3 },
      ];

      // When
      const decisions = useCase.evaluateSettings.execute({
        candidates: candidates,
        recipients: recipients,
      });

      // Then
      expect(
        decisions.map((decision) => (decision.status === "eligible" ? decision.ttlSeconds : null)),
      ).toEqual([45 * 60, 45 * 60, 12 * 3600]);
    });

    it.each([
      { stage: "60min", localNow: "09:00", ttlSeconds: 3600 },
      { stage: "10min", localNow: "09:50", ttlSeconds: 600 },
    ])(
      "$stage 할 일 리마인더는 받는 사람 시간대의 회차 시작까지 $ttlSeconds초 보관한다",
      async ({ stage, localNow, ttlSeconds }) => {
        // Given
        const { useCase } = createEvaluatePushDeliveryEligibilityUseCase(
          localInstant("Asia/Seoul", localNow),
        );
        const recipient = await useCase.loadRecipient.execute("user-1");
        const reminder = {
          ...transactional,
          type: "TODO_REMINDER" as const,
          metadata: { stage },
          reminderOccurrenceKey: "2026-07-16T10:00",
        };

        // When
        const decision = await useCase.evaluateEligibility.execute({
          data: reminder,
          recipient: recipient,
          rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
          hasReservedRateLimit: true,
        });

        // Then
        expect(decision).toEqual({ status: "eligible", candidate: reminder, ttlSeconds });
      },
    );

    describe("다시 알림은 할 일 시작 뒤에 울려도 처리기의 늦음 한도(울릴 시각 + 15분)까지 보관한다", () => {
      const remindAt = localInstant("Asia/Seoul", "10:05");

      it.each([
        { name: "울릴 시각에 보내면", sentLateMinutes: 0, ttlSeconds: 15 * 60 },
        { name: "2분 늦게 보내면", sentLateMinutes: 2, ttlSeconds: 13 * 60 },
        { name: "한도 30초 전에 보내면", sentLateMinutes: 14.5, ttlSeconds: 60 },
      ])("$name $ttlSeconds초다(최소 60초)", async ({ sentLateMinutes, ttlSeconds }) => {
        // Given
        const { useCase } = createEvaluatePushDeliveryEligibilityUseCase(
          remindAt.add({ seconds: sentLateMinutes * 60 }),
        );
        const recipient = await useCase.loadRecipient.execute("user-1");
        const snoozed = {
          ...transactional,
          type: "TODO_REMINDER" as const,
          metadata: createSnoozedReminderMetadata(remindAt),
          reminderOccurrenceKey: "1024",
        };

        // When
        const decision = await useCase.evaluateEligibility.execute({
          data: snoozed,
          recipient: recipient,
          rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
          hasReservedRateLimit: true,
        });

        // Then
        expect(decision).toEqual({ status: "eligible", candidate: snoozed, ttlSeconds });
      });

      it("울릴 시각이 없는 다시 알림은 회차 칸을 할 일 시작으로 읽지 않고 종류 기본값 1시간이다", async () => {
        // Given
        const { useCase } = createEvaluatePushDeliveryEligibilityUseCase(remindAt);
        const recipient = await useCase.loadRecipient.execute("user-1");
        const snoozed = {
          ...transactional,
          type: "TODO_REMINDER" as const,
          metadata: { stage: "snooze" },
          reminderOccurrenceKey: "2026-07-16T10:00",
        };

        // When
        const decision = await useCase.evaluateEligibility.execute({
          data: snoozed,
          recipient: recipient,
          rateLimitDispatchId: RATE_LIMIT_DISPATCH_ID,
          hasReservedRateLimit: true,
        });

        // Then
        expect(decision).toEqual({ status: "eligible", candidate: snoozed, ttlSeconds: 3600 });
      });
    });
  });
});
