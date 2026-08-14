import type { CurrentUserPayload } from "@aido/validators";
import { Logger } from "@nestjs/common";
import { createMockExecutionContext } from "@test/mocks";
import { of } from "rxjs";

import type { AuthUserActivityWriterPort } from "@/auth/application/ports/auth-collaboration.port";

import { LastActiveInterceptor } from "./last-active.interceptor";

describe("LastActiveInterceptor — 사용자 활동 기록", () => {
	let activityWriter: AuthUserActivityWriterPort;
	let interceptor: LastActiveInterceptor;
	let loggerError: jest.SpyInstance;

	beforeEach(() => {
		loggerError = jest.spyOn(Logger.prototype, "error").mockImplementation();
		activityWriter = {
			updateLastActiveAt: jest.fn().mockResolvedValue(undefined),
		};
		interceptor = new LastActiveInterceptor(activityWriter);
	});

	afterEach(() => {
		interceptor.onModuleDestroy();
		loggerError.mockRestore();
	});

	it("X-Timezone을 정규 IANA 타임존으로 변환해 활동 writer에 전달한다", () => {
		// Given - 인증 사용자와 IANA 별칭 헤더
		const { context } = createMockExecutionContext({
			user: {
				userId: "user-1",
				email: "user@example.com",
				sessionId: "session-1",
				role: "USER",
			},
			headers: { "x-timezone": "US/Eastern" },
		});

		// When - 인증 요청이 인터셉터를 통과하면
		interceptor.intercept(context, { handle: () => of("ok") });

		// Then - 런타임이 정규화한 타임존과 사용자 ID가 기록 경계로 전달된다
		expect(activityWriter.updateLastActiveAt).toHaveBeenCalledWith("user-1", "America/New_York");
	});

	it("기존 클라이언트가 X-Timezone을 보내지 않으면 UTC로 기록한다", () => {
		// Given - 타임존 헤더가 없는 인증 사용자
		const { context } = createMockExecutionContext({
			user: {
				userId: "user-legacy",
				email: "legacy@example.com",
				sessionId: "session-legacy",
				role: "USER",
			},
		});

		// When - 요청이 인터셉터를 통과하면
		interceptor.intercept(context, { handle: () => of("ok") });

		// Then - 기존 기본 날짜 경계 계약인 UTC를 사용한다
		expect(activityWriter.updateLastActiveAt).toHaveBeenCalledWith("user-legacy", "UTC");
	});

	it("같은 사용자의 한 시간 내 요청은 기존처럼 한 번만 기록한다", () => {
		// Given - 같은 사용자의 연속된 인증 요청
		const user: CurrentUserPayload = {
			userId: "user-throttled",
			email: "throttled@example.com",
			sessionId: "session-throttled",
			role: "USER",
		};
		const first = createMockExecutionContext({
			user,
			headers: { "x-timezone": "Asia/Seoul" },
		});
		const second = createMockExecutionContext({
			user,
			headers: { "x-timezone": "Asia/Seoul" },
		});

		// When - 한 시간 이내 두 요청이 통과하면
		interceptor.intercept(first.context, { handle: () => of("first") });
		interceptor.intercept(second.context, { handle: () => of("second") });

		// Then - 첫 기록만 fire-and-forget writer로 전달한다
		expect(activityWriter.updateLastActiveAt).toHaveBeenCalledTimes(1);
		expect(activityWriter.updateLastActiveAt).toHaveBeenCalledWith("user-throttled", "Asia/Seoul");
	});

	it("한 시간 이내라도 사용자 현지 날짜가 바뀌면 새 활동일을 기록한다", () => {
		// Given - 서울 현지 23:59와 다음 날 00:01인 같은 사용자 요청
		const user: CurrentUserPayload = {
			userId: "user-midnight",
			email: "midnight@example.com",
			sessionId: "session-midnight",
			role: "USER",
		};
		const beforeMidnight = createMockExecutionContext({
			user,
			headers: { "x-timezone": "Asia/Seoul" },
		});
		const afterMidnight = createMockExecutionContext({
			user,
			headers: { "x-timezone": "Asia/Seoul" },
		});
		const dateNow = jest.spyOn(Date, "now");

		try {
			// When - 현지 자정을 사이에 둔 두 요청이 통과하면
			dateNow.mockReturnValue(new Date("2026-07-26T14:59:00.000Z").getTime());
			interceptor.intercept(beforeMidnight.context, {
				handle: () => of("before"),
			});
			dateNow.mockReturnValue(new Date("2026-07-26T15:01:00.000Z").getTime());
			interceptor.intercept(afterMidnight.context, {
				handle: () => of("after"),
			});

			// Then - 시간 throttle보다 새 현지 날짜 기록이 우선한다
			expect(activityWriter.updateLastActiveAt).toHaveBeenCalledTimes(2);
		} finally {
			dateNow.mockRestore();
		}
	});

	it("활동 저장이 실패하면 같은 현지 날짜의 다음 요청이 재시도한다", async () => {
		// Given - 첫 저장만 실패하는 writer와 같은 현지 날짜의 요청
		jest
			.mocked(activityWriter.updateLastActiveAt)
			.mockRejectedValueOnce(new Error("database unavailable"))
			.mockResolvedValueOnce(undefined);
		const user: CurrentUserPayload = {
			userId: "user-retry",
			email: "retry@example.com",
			sessionId: "session-retry",
			role: "USER",
		};
		const first = createMockExecutionContext({
			user,
			headers: { "x-timezone": "Asia/Seoul" },
		});
		const retry = createMockExecutionContext({
			user,
			headers: { "x-timezone": "Asia/Seoul" },
		});

		// When - 첫 fire-and-forget 저장 실패가 처리된 뒤 다시 요청하면
		interceptor.intercept(first.context, { handle: () => of("first") });
		await Promise.resolve();
		await Promise.resolve();
		interceptor.intercept(retry.context, { handle: () => of("retry") });

		// Then - 실패한 throttle 슬롯을 비워 즉시 재시도한다
		expect(activityWriter.updateLastActiveAt).toHaveBeenCalledTimes(2);
	});

	it("이전 현지 날짜 저장 실패가 새 현지 날짜의 throttle을 지우지 않는다", async () => {
		// Given - 첫 날짜 저장이 지연되고 다음 날짜 저장이 성공하는 요청
		let rejectFirst: ((reason: Error) => void) | undefined;
		const firstWrite = new Promise<void>((_resolve, reject) => {
			rejectFirst = reject;
		});
		jest
			.mocked(activityWriter.updateLastActiveAt)
			.mockImplementationOnce(() => firstWrite)
			.mockResolvedValueOnce(undefined);
		const user: CurrentUserPayload = {
			userId: "user-stale-failure",
			email: "stale-failure@example.com",
			sessionId: "session-stale-failure",
			role: "USER",
		};
		const request = () =>
			createMockExecutionContext({
				user,
				headers: { "x-timezone": "Asia/Seoul" },
			});
		const dateNow = jest.spyOn(Date, "now");

		try {
			// When - 다음 날짜가 기록된 뒤 이전 날짜의 요청만 실패하면
			dateNow.mockReturnValue(new Date("2026-07-26T14:59:00.000Z").getTime());
			interceptor.intercept(request().context, { handle: () => of("old") });
			dateNow.mockReturnValue(new Date("2026-07-26T15:01:00.000Z").getTime());
			interceptor.intercept(request().context, { handle: () => of("new") });
			rejectFirst?.(new Error("late failure"));
			await Promise.resolve();
			await Promise.resolve();
			dateNow.mockReturnValue(new Date("2026-07-26T15:02:00.000Z").getTime());
			interceptor.intercept(request().context, {
				handle: () => of("new-again"),
			});

			// Then - 새 날짜의 성공한 throttle 슬롯은 그대로 유지된다
			expect(activityWriter.updateLastActiveAt).toHaveBeenCalledTimes(2);
		} finally {
			dateNow.mockRestore();
		}
	});
});
