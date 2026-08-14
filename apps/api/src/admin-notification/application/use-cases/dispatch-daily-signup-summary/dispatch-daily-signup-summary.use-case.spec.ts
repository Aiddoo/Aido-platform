/**
 * DispatchDailySignupSummaryUseCase 단위 테스트
 *
 * - 전일(KST) 가입 통계 집계 후 admin 채널 SEND 잡 등록
 * - 집계 기간(전일 KST 00:00 ~ 당일 KST 00:00) 계산
 * - 실패(집계/큐)는 예외를 전파하지 않는다
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	ADMIN_NOTIFICATION_QUEUE_PORT,
	type AdminNotificationQueuePort,
} from "../../ports/admin-notification-queue.port";
import {
	SIGNUP_STATS_READER,
	type SignupStatsReaderPort,
} from "../../ports/signup-stats.reader.port";
import { DispatchDailySignupSummaryUseCase } from "./dispatch-daily-signup-summary.use-case";

describe("DispatchDailySignupSummaryUseCase", () => {
	let useCase: DispatchDailySignupSummaryUseCase;
	let reader: Mocked<SignupStatsReaderPort>;
	let queue: Mocked<AdminNotificationQueuePort>;

	beforeEach(async () => {
		jest.useFakeTimers();

		const { unit, unitRef } = await TestBed.solitary(DispatchDailySignupSummaryUseCase).compile();
		useCase = unit;
		reader = unitRef.get(SIGNUP_STATS_READER);
		queue = unitRef.get(ADMIN_NOTIFICATION_QUEUE_PORT);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	/** enqueueSend 호출의 notification 인자 추출 */
	function getNotification() {
		return queue.enqueueSend.mock.calls[0]?.[1];
	}

	it("일일 가입 요약을 큐에 등록한다", async () => {
		// Given
		jest.setSystemTime(new Date("2026-02-11T00:00:00+09:00"));
		reader.getSignupStats.mockResolvedValue({
			signupsByProvider: [
				{ provider: "CREDENTIAL", count: 3 },
				{ provider: "GOOGLE", count: 2 },
			],
			totalUsers: 150,
		});

		// When
		await useCase.execute();

		// Then — 집계 기간(전일 KST)
		expect(reader.getSignupStats).toHaveBeenCalledWith(
			new Date("2026-02-09T15:00:00.000Z"),
			new Date("2026-02-10T15:00:00.000Z"),
		);

		// Then — 큐 등록 메시지 + jobId
		expect(queue.enqueueSend).toHaveBeenCalledWith(
			"admin",
			expect.objectContaining({
				title: "일일 가입 리포트 | 2026-02-10 (KST)",
				body: "전일 신규 가입은 5명입니다.\n\n가입 채널별\n- 이메일: 3명\n- Google: 2명",
				fields: expect.arrayContaining([
					expect.objectContaining({ name: "전일 신규 가입", value: "5명" }),
					expect.objectContaining({
						name: "집계 기준",
						value: "2026-02-10 00:00 ~ 23:59 (KST)",
					}),
				]),
			}),
			expect.objectContaining({ jobId: "signup-summary_2026-02-10" }),
		);
	});

	it("가입자가 없으면 해당 메시지를 표시한다", async () => {
		// Given
		jest.setSystemTime(new Date("2026-02-11T00:00:00+09:00"));
		reader.getSignupStats.mockResolvedValue({
			signupsByProvider: [],
			totalUsers: 100,
		});

		// When
		await useCase.execute();

		// Then
		const notification = getNotification();
		expect(notification?.body).toBe("전일 신규 가입은 0명입니다.");
		expect(notification?.fields).toEqual(
			expect.arrayContaining([expect.objectContaining({ name: "전일 신규 가입", value: "0명" })]),
		);
	});

	it("집계 DB 에러가 발생해도 예외가 전파되지 않는다", async () => {
		// Given
		reader.getSignupStats.mockRejectedValue(new Error("DB connection error"));

		// When & Then
		await expect(useCase.execute()).resolves.not.toThrow();
		expect(queue.enqueueSend).not.toHaveBeenCalled();
	});

	it("큐 등록 실패해도 예외가 전파되지 않는다", async () => {
		// Given
		jest.setSystemTime(new Date("2026-02-11T00:00:00+09:00"));
		reader.getSignupStats.mockResolvedValue({
			signupsByProvider: [],
			totalUsers: 100,
		});
		queue.enqueueSend.mockRejectedValue(new Error("Queue error"));

		// When & Then
		await expect(useCase.execute()).resolves.not.toThrow();
	});
});
