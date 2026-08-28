import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createNotificationRecipientPreferenceReaderMock } from "@test/mocks/ports/notification.mock";

import {
	NOTIFICATION_RECIPIENT_PREFERENCE_READER,
	type NotificationRecipientPreferenceReaderPort,
} from "../ports/notification-recipient-preference.reader.port";
import { PUSH_RATE_LIMITER, type PushRateLimiterPort } from "../ports/push-rate-limiter.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type NotificationDeliveryPreference,
	type UserNotificationSettingsPort,
} from "../ports/user-notification-settings.port";
import { PushDeliveryEligibilityService } from "./push-delivery-eligibility.service";

const DAYTIME = new Date("2026-07-16T03:00:00.000Z");
const KST_NIGHT = new Date("2026-07-16T14:00:00.000Z");
const RATE_LIMIT_DISPATCH_ID = 101;

function preference(
	overrides: Partial<NotificationDeliveryPreference> = {},
): NotificationDeliveryPreference {
	return {
		pushEnabled: true,
		nightPushEnabled: true,
		timezone: "Asia/Seoul",
		locale: "ko",
		morningReminderHour: 8,
		morningReminderMinute: 0,
		eveningReminderHour: 19,
		eveningReminderMinute: 0,
		timeFormat: "TWENTY_FOUR_HOUR",
		weatherMorningEnabled: true,
		weatherMorningHour: 7,
		weatherMorningMinute: 0,
		weatherEveningEnabled: true,
		weatherEveningHour: 17,
		weatherEveningMinute: 30,
		...overrides,
	};
}

const transactional = {
	userId: "user-1",
	type: "FOLLOW_NEW" as const,
	title: "title",
	body: "body",
};

const engagement = {
	...transactional,
	type: "LUNCH_NUDGE" as const,
	purpose: "ENGAGEMENT" as const,
};

describe("PushDeliveryEligibilityService", () => {
	let service: PushDeliveryEligibilityService;
	let settings: Mocked<UserNotificationSettingsPort>;
	let rateLimiter: Mocked<PushRateLimiterPort>;
	let preferenceReader: Mocked<NotificationRecipientPreferenceReaderPort>;

	beforeEach(async () => {
		jest.useFakeTimers().setSystemTime(DAYTIME);
		const { unit, unitRef } = await TestBed.solitary(PushDeliveryEligibilityService)
			.mock<NotificationRecipientPreferenceReaderPort>(NOTIFICATION_RECIPIENT_PREFERENCE_READER)
			.impl(() => createNotificationRecipientPreferenceReaderMock())
			.compile();
		service = unit;
		settings = unitRef.get(USER_NOTIFICATION_SETTINGS);
		rateLimiter = unitRef.get(PUSH_RATE_LIMITER);
		preferenceReader = unitRef.get(NOTIFICATION_RECIPIENT_PREFERENCE_READER);
		preferenceReader.getPreference.mockResolvedValue(preference());
		rateLimiter.reserveGeneral.mockResolvedValue(false);
		rateLimiter.reserveEngagement.mockResolvedValue(false);
	});

	afterEach(() => jest.useRealTimers());

	it("단건 수신자 컨텍스트는 미상 UTC를 배송용 KST와 현지 날짜로 보정한다", async () => {
		preferenceReader.getPreference.mockResolvedValue(preference({ timezone: "UTC" }));

		await expect(service.loadSingleRecipient("user-1")).resolves.toMatchObject({
			userId: "user-1",
			timezone: "Asia/Seoul",
			localDate: "2026-07-16",
		});
	});

	it("단건은 push 비활성 설정을 가장 먼저 거부하고 rate counter를 소비하지 않는다", async () => {
		const recipient = {
			...(await service.loadSingleRecipient("user-1")),
			preference: preference({ pushEnabled: false }),
		};

		await expect(
			service.evaluateSingle(transactional, recipient, RATE_LIMIT_DISPATCH_ID, false),
		).resolves.toEqual({
			status: "skipped",
			candidate: transactional,
			reason: "PUSH_DISABLED",
		});
		expect(rateLimiter.reserveGeneral).not.toHaveBeenCalled();
	});

	it("단건은 일반 rate 제한을 야간·마케팅 동의 조회보다 먼저 판정한다", async () => {
		rateLimiter.reserveGeneral.mockResolvedValue(true);
		const recipient = await service.loadSingleRecipient("user-1");

		await expect(
			service.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, false),
		).resolves.toMatchObject({
			status: "skipped",
			reason: "RATE_LIMITED",
		});
		expect(settings.getConsentRecord).not.toHaveBeenCalled();
		expect(rateLimiter.reserveEngagement).not.toHaveBeenCalled();
	});

	it("단건 마케팅은 야간 quiet-hours를 동의 조회보다 앞서 적용한다", async () => {
		jest.setSystemTime(KST_NIGHT);
		const recipient = await service.loadSingleRecipient("user-1");

		await expect(
			service.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, false),
		).resolves.toMatchObject({
			status: "skipped",
			reason: "MARKETING_QUIET_HOURS",
		});
		expect(settings.getConsentRecord).not.toHaveBeenCalled();
	});

	it("단건 참여 유도는 동의 후 현지 날짜 engagement 제한을 별도로 판정한다", async () => {
		settings.getConsentRecord.mockResolvedValue({ marketingPushAgreedAt: DAYTIME });
		rateLimiter.reserveEngagement.mockResolvedValue(true);
		const recipient = await service.loadSingleRecipient("user-1");

		await expect(
			service.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, false),
		).resolves.toMatchObject({
			status: "skipped",
			reason: "ENGAGEMENT_RATE_LIMITED",
		});
		expect(rateLimiter.reserveEngagement).toHaveBeenCalledWith({
			dispatchId: RATE_LIMIT_DISPATCH_ID,
			userId: "user-1",
			localDate: "2026-07-16",
		});
	});

	it("재시도는 저장된 rate 예약을 재사용해도 현재 push 비활성 설정을 즉시 반영한다", async () => {
		const recipient = {
			...(await service.loadSingleRecipient("user-1")),
			preference: preference({ pushEnabled: false }),
		};

		await expect(
			service.evaluateSingle(transactional, recipient, RATE_LIMIT_DISPATCH_ID, true),
		).resolves.toMatchObject({ status: "skipped", reason: "PUSH_DISABLED" });
		expect(rateLimiter.reserveGeneral).not.toHaveBeenCalled();
		expect(rateLimiter.reserveEngagement).not.toHaveBeenCalled();
	});

	it("재시도는 rate counter를 다시 쓰지 않고 철회된 marketing consent를 반영한다", async () => {
		settings.getConsentRecord.mockResolvedValue({ marketingPushAgreedAt: null });
		const recipient = await service.loadSingleRecipient("user-1");

		await expect(
			service.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, true),
		).resolves.toMatchObject({ status: "skipped", reason: "MARKETING_CONSENT_REQUIRED" });
		expect(rateLimiter.reserveGeneral).not.toHaveBeenCalled();
		expect(rateLimiter.reserveEngagement).not.toHaveBeenCalled();
	});

	it("재시도 시 quiet-hours로 전환되면 저장된 rate 예약과 무관하게 마케팅을 중단한다", async () => {
		jest.setSystemTime(KST_NIGHT);
		const recipient = await service.loadSingleRecipient("user-1");

		await expect(
			service.evaluateSingle(engagement, recipient, RATE_LIMIT_DISPATCH_ID, true),
		).resolves.toMatchObject({ status: "skipped", reason: "MARKETING_QUIET_HOURS" });
		expect(rateLimiter.reserveGeneral).not.toHaveBeenCalled();
		expect(rateLimiter.reserveEngagement).not.toHaveBeenCalled();
	});

	it("배치는 설정·동의를 한 번씩 bulk 조회하고 설정 행 부재를 명시적으로 보존한다", async () => {
		settings.getPreferenceRecordsByUserIds.mockResolvedValue([
			{ userId: "user-1", ...preference() },
		]);
		settings.getConsentRecordsByUserIds.mockResolvedValue([]);

		const recipients = await service.loadBatchRecipients(["user-1", "user-2", "user-1"]);

		expect(settings.getPreferenceRecordsByUserIds).toHaveBeenCalledWith(["user-1", "user-2"]);
		expect(settings.getConsentRecordsByUserIds).toHaveBeenCalledWith(["user-1", "user-2"]);
		expect(recipients.get("user-2")).toMatchObject({
			preference: undefined,
			timezone: "Asia/Seoul",
		});
	});

	it("배치 설정 판정은 force 비마케팅만 우회하고 마케팅 동의와 설정 부재 이유를 구분한다", async () => {
		settings.getPreferenceRecordsByUserIds.mockResolvedValue([
			{ userId: "marketing", ...preference() },
		]);
		settings.getConsentRecordsByUserIds.mockResolvedValue([]);
		const recipients = await service.loadBatchRecipients(["forced", "missing", "marketing"]);
		const forced = {
			data: { ...transactional, userId: "forced", type: "ADMIN_BROADCAST" as const, force: true },
			rateLimitDispatchId: 1,
		};
		const missing = {
			data: { ...transactional, userId: "missing" },
			rateLimitDispatchId: 2,
		};
		const marketing = {
			data: { ...engagement, userId: "marketing" },
			rateLimitDispatchId: 3,
		};

		expect(service.evaluateBatchSettings([forced, missing, marketing], recipients)).toEqual([
			{ status: "eligible", candidate: forced },
			{ status: "skipped", candidate: missing, reason: "PUSH_SETTINGS_MISSING" },
			{
				status: "skipped",
				candidate: marketing,
				reason: "MARKETING_CONSENT_REQUIRED",
			},
		]);
	});

	it("배치 rate 예약은 입력 순서·현지 날짜를 보존하고 모든 제한을 RATE_LIMITED로 정규화한다", async () => {
		settings.getPreferenceRecordsByUserIds.mockResolvedValue([
			{ userId: "user-1", ...preference() },
			{ userId: "user-2", ...preference({ timezone: "America/New_York" }) },
		]);
		settings.getConsentRecordsByUserIds.mockResolvedValue([]);
		rateLimiter.reserveBatch.mockResolvedValue([false, true]);
		const recipients = await service.loadBatchRecipients(["user-1", "user-2"]);
		const first = { data: engagement, rateLimitDispatchId: 1 };
		const second = {
			data: { ...engagement, userId: "user-2" },
			rateLimitDispatchId: 2,
		};

		await expect(service.reserveBatch([first, second], recipients)).resolves.toEqual([
			{ status: "eligible", candidate: first },
			{ status: "skipped", candidate: second, reason: "RATE_LIMITED" },
		]);
		expect(rateLimiter.reserveBatch).toHaveBeenCalledWith([
			{
				dispatchId: 1,
				userId: "user-1",
				engagementLocalDate: "2026-07-16",
			},
			{
				dispatchId: 2,
				userId: "user-2",
				engagementLocalDate: "2026-07-15",
			},
		]);
	});
});
