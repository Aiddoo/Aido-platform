/**
 * TimezoneSelfHealInterceptor 단위 테스트
 *
 * 인증 요청의 X-Timezone 헤더로 UserPreference.timezone을 자가치유한다.
 * 스로틀(같은 tz는 창 안에서 1회) + tz 변경 시 즉시 반영을 검증한다.
 */
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { of } from "rxjs";
import { UserSettingsFacade } from "../../application/facades/user-settings.facade";
import { TimezoneSelfHealInterceptor } from "./timezone-self-heal.interceptor";

const nextHandler: CallHandler = { handle: () => of("ok") };

function contextFor(
	user: { userId: string } | undefined,
	headers: Record<string, unknown>,
): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => ({ user, headers }) }),
	} as unknown as ExecutionContext;
}

describe("TimezoneSelfHealInterceptor", () => {
	let interceptor: TimezoneSelfHealInterceptor;
	let facade: Mocked<UserSettingsFacade>;

	beforeEach(async () => {
		jest.useFakeTimers();
		const { unit, unitRef } = await TestBed.solitary(
			TimezoneSelfHealInterceptor,
		).compile();
		interceptor = unit;
		facade = unitRef.get(UserSettingsFacade);
		facade.refreshPushTimezoneIfChanged.mockResolvedValue(undefined);
	});

	afterEach(() => {
		interceptor.onModuleDestroy();
		jest.useRealTimers();
	});

	it("인증 유저 + 유효한 X-Timezone이면 자가치유를 호출한다", () => {
		interceptor.intercept(
			contextFor({ userId: "u1" }, { "x-timezone": "Asia/Seoul" }),
			nextHandler,
		);

		expect(facade.refreshPushTimezoneIfChanged).toHaveBeenCalledWith(
			"u1",
			"Asia/Seoul",
		);
	});

	it("미인증(user 없음)이면 호출하지 않는다", () => {
		interceptor.intercept(
			contextFor(undefined, { "x-timezone": "Asia/Seoul" }),
			nextHandler,
		);

		expect(facade.refreshPushTimezoneIfChanged).not.toHaveBeenCalled();
	});

	it("무효/누락 타임존 헤더면 호출하지 않는다", () => {
		interceptor.intercept(contextFor({ userId: "u1" }, {}), nextHandler);
		interceptor.intercept(
			contextFor({ userId: "u1" }, { "x-timezone": "Mars/Olympus" }),
			nextHandler,
		);

		expect(facade.refreshPushTimezoneIfChanged).not.toHaveBeenCalled();
	});

	it("같은 tz는 스로틀 창 안에서 한 번만 호출한다", () => {
		const ctx = contextFor({ userId: "u1" }, { "x-timezone": "Asia/Seoul" });

		interceptor.intercept(ctx, nextHandler);
		interceptor.intercept(ctx, nextHandler);

		expect(facade.refreshPushTimezoneIfChanged).toHaveBeenCalledTimes(1);
	});

	it("tz가 바뀌면 즉시 다시 호출한다 (여행 등)", () => {
		interceptor.intercept(
			contextFor({ userId: "u1" }, { "x-timezone": "Asia/Seoul" }),
			nextHandler,
		);
		interceptor.intercept(
			contextFor({ userId: "u1" }, { "x-timezone": "America/New_York" }),
			nextHandler,
		);

		expect(facade.refreshPushTimezoneIfChanged).toHaveBeenCalledTimes(2);
		expect(facade.refreshPushTimezoneIfChanged).toHaveBeenLastCalledWith(
			"u1",
			"America/New_York",
		);
	});
});
