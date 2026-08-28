/**
 * WeeklyReportStrategy 전략 단위 테스트
 *
 * @description
 * WeeklyReportStrategy의 실행 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test weekly-report.strategy
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import dayjs from "dayjs";

import { createWeeklyReportNotificationMessage, NotificationSender } from "@/notification";

import type { TimezoneContext } from "../../domain/services/timezone-context";
import {
	SCHEDULED_REMINDER_READER,
	type ScheduledReminderReaderPort,
} from "../ports/scheduled-reminder-reader.port";
import {
	SCHEDULER_PREFERENCE_READER,
	type SchedulerPreferenceReaderPort,
} from "../ports/scheduler-preference-reader.port";
import { WeeklyReportStrategy } from "./weekly-report.strategy";

describe("WeeklyReportStrategy — 주간 리포트 전략", () => {
	let strategy: WeeklyReportStrategy;
	let reader: Mocked<ScheduledReminderReaderPort>;
	let preferenceReader: Mocked<SchedulerPreferenceReaderPort>;
	let notificationService: Mocked<NotificationSender>;

	const TZ = "Asia/Seoul";

	/** KST 2024-01-15 (월요일) 09:00 = UTC 2024-01-15T00:00:00Z */
	const FAKE_NOW = new Date("2024-01-15T00:00:00Z");

	const makeCtx = (overrides?: Partial<TimezoneContext>): TimezoneContext => ({
		tz: TZ,
		localHour: 9,
		localMinute: 0,
		dayOfWeek: 1,
		today: dayjs.utc("2024-01-15").startOf("day").toDate(),
		tomorrow: dayjs.utc("2024-01-16").startOf("day").toDate(),
		...overrides,
	});

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(FAKE_NOW);

		const { unit, unitRef } = await TestBed.solitary(WeeklyReportStrategy).compile();

		strategy = unit;
		reader = unitRef.get(SCHEDULED_REMINDER_READER);
		preferenceReader = unitRef.get(SCHEDULER_PREFERENCE_READER);
		notificationService = unitRef.get(NotificationSender);

		// 기본 mock 설정
		reader.findWeeklyReportRecipients.mockResolvedValue([]);
		preferenceReader.findUserLocales.mockResolvedValue(new Map());
		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		notificationService.createAndSendBatch.mockResolvedValue({ count: 0 });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("프리미엄 유저 전체에게 주간 리포트를 발송한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findWeeklyReportRecipients.mockResolvedValue([{ id: "user-1" }]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });

		// AI 리포트는 유료 기능 → 프리미엄 유저만 조회 (pushEnabled 필터 없음, 푸시 전송은 PushDeliveryService가 담당)
		expect(reader.findWeeklyReportRecipients).toHaveBeenCalledTimes(1);
		expect(reader.findWeeklyReportRecipients).toHaveBeenCalledWith(
			expect.objectContaining({ tz: TZ }),
		);

		const notifications = notificationService.createAndSendBatch.mock.calls[0]?.[0];
		const expected = createWeeklyReportNotificationMessage();
		expect(notifications?.[0]).toMatchObject({
			userId: "user-1",
			type: "WEEKLY_REPORT",
			title: expected.title,
			body: expected.body,
		});
	});

	it("이미 알림 받은 사용자를 제외한다", async () => {
		// Given
		const ctx = makeCtx();

		reader.findWeeklyReportRecipients.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);

		notificationService.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1"]));

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 1 });
		const notifications = notificationService.createAndSendBatch.mock.calls[0]?.[0];
		expect(notifications).toHaveLength(1);
		expect(notifications?.[0]?.userId).toBe("user-2");
	});

	it("대상이 없으면 createAndSendBatch를 호출하지 않는다", async () => {
		// Given — beforeEach 기본 설정
		const ctx = makeCtx();

		reader.findWeeklyReportRecipients.mockResolvedValue([]);

		// When
		const result = await strategy.execute(ctx);

		// Then
		expect(result).toEqual({ sent: 0 });
		expect(notificationService.createAndSendBatch).not.toHaveBeenCalled();
	});
});
