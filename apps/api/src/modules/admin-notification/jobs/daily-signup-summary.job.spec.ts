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

	it("일일 가입 요약을 발송한다", async () => {
		// Given
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
				title: expect.stringContaining("일일 가입 리포트"),
				fields: expect.arrayContaining([
					expect.objectContaining({
						name: "오늘 신규 가입",
						value: "5명",
					}),
				]),
			}),
		);
	});

	it("가입자가 없으면 해당 메시지를 표시한다", async () => {
		// Given
		(database.account.groupBy as jest.Mock).mockResolvedValue([]);
		(database.user.count as jest.Mock).mockResolvedValue(100);

		// When
		await job.handleDailySummary();

		// Then
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				body: "오늘 신규 가입자가 없습니다.",
				fields: expect.arrayContaining([
					expect.objectContaining({
						name: "오늘 신규 가입",
						value: "0명",
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
