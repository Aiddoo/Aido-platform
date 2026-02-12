import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database/database.service";

import { ADMIN_NOTIFIER } from "../providers/admin-notifier.interface";
import { DailySignupSummaryJob } from "./daily-signup-summary.job";

describe("DailySignupSummaryJob", () => {
	let job: DailySignupSummaryJob;
	let database: Mocked<DatabaseService>;
	let notifier: { send: jest.Mock };

	beforeEach(async () => {
		jest.useFakeTimers();

		const mockNotifier = {
			name: "fake",
			send: jest.fn().mockResolvedValue({ success: true }),
			isConfigured: jest.fn().mockReturnValue(true),
		};

		const { unit, unitRef } = await TestBed.solitary(DailySignupSummaryJob)
			.mock(ADMIN_NOTIFIER)
			.impl(() => mockNotifier)
			.compile();

		job = unit;
		database = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
		notifier = mockNotifier;

		// database.account.groupBy, database.user.count mock 설정
		Object.defineProperty(database, "account", {
			value: { groupBy: jest.fn() },
			configurable: true,
			writable: true,
		});
		Object.defineProperty(database, "user", {
			value: { count: jest.fn() },
			configurable: true,
			writable: true,
		});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("일일 가입 요약을 발송한다", async () => {
		// Given
		jest.setSystemTime(new Date("2026-02-11T00:00:00+09:00"));
		(database.account.groupBy as jest.Mock).mockResolvedValue([
			{ provider: "CREDENTIAL", _count: 3 },
			{ provider: "GOOGLE", _count: 2 },
		]);
		(database.user.count as jest.Mock).mockResolvedValue(150);

		// When
		await job.handleDailySummary();

		// Then
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "일일 가입 리포트 | 2026-02-10 (KST)",
				body: "전일 신규 가입은 5명입니다.\n\n가입 채널별\n- 이메일: 3명\n- Google: 2명",
				fields: expect.arrayContaining([
					expect.objectContaining({
						name: "전일 신규 가입",
						value: "5명",
					}),
					expect.objectContaining({
						name: "집계 기준",
						value: "2026-02-10 00:00 ~ 23:59 (KST)",
					}),
				]),
			}),
		);

		expect(database.account.groupBy).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					createdAt: {
						gte: new Date("2026-02-09T15:00:00.000Z"),
						lt: new Date("2026-02-10T15:00:00.000Z"),
					},
				},
			}),
		);
	});

	it("가입자가 없으면 해당 메시지를 표시한다", async () => {
		// Given
		jest.setSystemTime(new Date("2026-02-11T00:00:00+09:00"));
		(database.account.groupBy as jest.Mock).mockResolvedValue([]);
		(database.user.count as jest.Mock).mockResolvedValue(100);

		// When
		await job.handleDailySummary();

		// Then
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				body: "전일 신규 가입은 0명입니다.",
				fields: expect.arrayContaining([
					expect.objectContaining({
						name: "전일 신규 가입",
						value: "0명",
					}),
					expect.objectContaining({
						name: "집계 기준",
						value: "2026-02-10 00:00 ~ 23:59 (KST)",
					}),
				]),
			}),
		);
	});

	it("DB 에러가 발생해도 예외가 전파되지 않는다", async () => {
		// Given
		(database.account.groupBy as jest.Mock).mockRejectedValue(
			new Error("DB connection error"),
		);

		// When & Then
		await expect(job.handleDailySummary()).resolves.not.toThrow();
	});

	it("알림 발송 실패해도 예외가 전파되지 않는다", async () => {
		// Given
		(database.account.groupBy as jest.Mock).mockResolvedValue([]);
		(database.user.count as jest.Mock).mockResolvedValue(100);
		notifier.send.mockRejectedValue(new Error("Webhook error"));

		// When & Then
		await expect(job.handleDailySummary()).resolves.not.toThrow();
	});
});
