import { InMemoryUserNotificationSettings } from "#test/doubles/notification/in-memory-user-notification-settings";
import { StubNotificationRecipientPreferenceReader } from "#test/doubles/notification/stub-notification-recipient-preference.reader";
import { StubPushRateLimiter } from "#test/doubles/notification/stub-push-rate-limiter";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createNotificationDeliveryPreferenceFixture } from "#test/fixtures/notification/notification-delivery-preference.fixture";
import { createNotificationDraftFixture } from "#test/fixtures/notification/notification.fixture";

import { EvaluatePushDeliveryEligibilityUseCase } from "./evaluate-push-delivery-eligibility.use-case.js";

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

function createEvaluatePushDeliveryEligibilityUseCase(now: Temporal.Instant = DAYTIME) {
  const userSettings = new InMemoryUserNotificationSettings();
  const rateLimiter = new StubPushRateLimiter();
  const recipientPreferenceReader = new StubNotificationRecipientPreferenceReader();
  const useCase = new EvaluatePushDeliveryEligibilityUseCase({
    userSettings,
    rateLimiter,
    recipientPreferenceReader,
    clock: new FixedClock(now),
  });
  return { useCase, userSettings, rateLimiter, recipientPreferenceReader };
}

describe("EvaluatePushDeliveryEligibilityUseCase — 푸시 발송 자격 판정", () => {
  it("단건 수신자 컨텍스트는 미상 UTC를 배송용 KST와 현지 날짜로 보정한다", async () => {
    // Given
    const { useCase, recipientPreferenceReader } = createEvaluatePushDeliveryEligibilityUseCase();
    recipientPreferenceReader.preferences.set(
      "user-1",
      createNotificationDeliveryPreferenceFixture({ timezone: "UTC" }),
    );

    // When
    const recipient = useCase.loadSingleRecipient("user-1");

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
      ...(await useCase.loadSingleRecipient("user-1")),
      preference: createNotificationDeliveryPreferenceFixture({ pushEnabled: false }),
    };

    // When
    const decision = useCase.evaluateSingle(
      transactional,
      recipient,
      RATE_LIMIT_DISPATCH_ID,
      false,
    );

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
    const recipient = await useCase.loadSingleRecipient("user-1");

    // When
    const decision = useCase.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, false);

    // Then
    await expect(decision).resolves.toMatchObject({ status: "skipped", reason: "RATE_LIMITED" });
    expect(userSettings.consentReadUserIds).toEqual([]);
    expect(rateLimiter.engagementRequests).toEqual([]);
  });

  it("단건 마케팅은 야간 quiet-hours를 동의 조회보다 앞서 적용한다", async () => {
    // Given
    const { useCase, userSettings } = createEvaluatePushDeliveryEligibilityUseCase(KST_NIGHT);
    const recipient = await useCase.loadSingleRecipient("user-1");

    // When
    const decision = useCase.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, false);

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
    const recipient = await useCase.loadSingleRecipient("user-1");

    // When
    const decision = useCase.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, false);

    // Then
    await expect(decision).resolves.toMatchObject({
      status: "skipped",
      reason: "ENGAGEMENT_RATE_LIMITED",
    });
    expect(rateLimiter.engagementRequests).toEqual([
      { dispatchId: RATE_LIMIT_DISPATCH_ID, userId: "user-1", localDate: "2026-07-16" },
    ]);
  });

  it("재시도는 저장된 rate 예약을 재사용해도 현재 push 비활성 설정을 즉시 반영한다", async () => {
    // Given
    const { useCase, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
    const recipient = {
      ...(await useCase.loadSingleRecipient("user-1")),
      preference: createNotificationDeliveryPreferenceFixture({ pushEnabled: false }),
    };

    // When
    const decision = useCase.evaluateSingle(transactional, recipient, RATE_LIMIT_DISPATCH_ID, true);

    // Then
    await expect(decision).resolves.toMatchObject({ status: "skipped", reason: "PUSH_DISABLED" });
    expect(rateLimiter.reservationCount).toBe(0);
  });

  it("재시도는 rate counter를 다시 쓰지 않고 철회된 marketing consent를 반영한다", async () => {
    // Given
    const { useCase, userSettings, rateLimiter } = createEvaluatePushDeliveryEligibilityUseCase();
    userSettings.consents.set("user-1", { marketingPushAgreedAt: null });
    const recipient = await useCase.loadSingleRecipient("user-1");

    // When
    const decision = useCase.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, true);

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
    const recipient = await useCase.loadSingleRecipient("user-1");

    // When
    const decision = useCase.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, true);

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
    const recipients = await useCase.loadBatchRecipients(["user-1", "user-2", "user-1"]);

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
    const recipients = await useCase.loadBatchRecipients(["forced", "missing", "marketing"]);
    const forced = {
      data: { ...transactional, userId: "forced", type: "ADMIN_BROADCAST" as const, force: true },
      rateLimitDispatchId: 1,
    };
    const missing = { data: { ...transactional, userId: "missing" }, rateLimitDispatchId: 2 };
    const marketing = { data: { ...engagement, userId: "marketing" }, rateLimitDispatchId: 3 };

    // When
    const decisions = useCase.evaluateBatchSettings([forced, missing, marketing], recipients);

    // Then
    expect(decisions).toEqual([
      { status: "eligible", candidate: forced },
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
    const recipients = await useCase.loadBatchRecipients(["user-1", "user-2"]);
    const first = { data: engagement, rateLimitDispatchId: 1 };
    const second = { data: { ...engagement, userId: "user-2" }, rateLimitDispatchId: 2 };

    // When
    const decisions = await useCase.reserveBatch([first, second], recipients);

    // Then
    expect(decisions).toEqual([
      { status: "eligible", candidate: first },
      { status: "skipped", candidate: second, reason: "RATE_LIMITED" },
    ]);
    expect(rateLimiter.batchRequests).toEqual([
      [
        { dispatchId: 1, userId: "user-1", engagementLocalDate: "2026-07-16" },
        { dispatchId: 2, userId: "user-2", engagementLocalDate: "2026-07-15" },
      ],
    ]);
  });
});
