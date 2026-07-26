import type { CurrentUserPayload } from "@aido/validators";
import { createMockExecutionContext } from "@test/mocks";
import { of } from "rxjs";
import type { AuthUserActivityWriterPort } from "@/auth/application/ports/auth-collaboration.port";
import { LastActiveInterceptor } from "./last-active.interceptor";

describe("LastActiveInterceptor — 사용자 활동 기록", () => {
	let activityWriter: AuthUserActivityWriterPort;
	let interceptor: LastActiveInterceptor;

	beforeEach(() => {
		activityWriter = {
			updateLastActiveAt: jest.fn().mockResolvedValue(undefined),
		};
		interceptor = new LastActiveInterceptor(activityWriter);
	});

	afterEach(() => {
		interceptor.onModuleDestroy();
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
		expect(activityWriter.updateLastActiveAt).toHaveBeenCalledWith(
			"user-1",
			"America/New_York",
		);
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
		expect(activityWriter.updateLastActiveAt).toHaveBeenCalledWith(
			"user-legacy",
			"UTC",
		);
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
			headers: { "x-timezone": "America/New_York" },
		});

		// When - 한 시간 이내 두 요청이 통과하면
		interceptor.intercept(first.context, { handle: () => of("first") });
		interceptor.intercept(second.context, { handle: () => of("second") });

		// Then - 첫 기록만 fire-and-forget writer로 전달한다
		expect(activityWriter.updateLastActiveAt).toHaveBeenCalledTimes(1);
		expect(activityWriter.updateLastActiveAt).toHaveBeenCalledWith(
			"user-throttled",
			"Asia/Seoul",
		);
	});
});
