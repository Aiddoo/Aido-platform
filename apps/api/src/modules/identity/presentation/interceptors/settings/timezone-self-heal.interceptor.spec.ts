/**
 * TimezoneSelfHealInterceptor 단위 테스트
 *
 * 인증 요청의 X-Timezone 헤더로 UserPreference.timezone을 자가치유한다.
 * 스로틀(같은 tz는 창 안에서 1회) + tz 변경 시 즉시 반영을 검증한다.
 */
import { Logger, type CallHandler, type ExecutionContext } from "@nestjs/common";
import { TestBed } from "@suites/unit";
import { of } from "rxjs";
import { vi } from "vitest";
import type { Mocked } from "vitest";

import { IdentitySettingsLogEvent } from "../../../application/observability/settings/identity-settings-log.events.js";
import { RefreshPushTimezone } from "../../../application/use-cases/settings/refresh-push-timezone.use-case.js";
import { TimezoneSelfHealInterceptor } from "./timezone-self-heal.interceptor.js";

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
  let refreshPushTimezoneUseCase: Mocked<RefreshPushTimezone>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-16T09:00:00.000Z"));
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const { unit, unitRef } = await TestBed.solitary(TimezoneSelfHealInterceptor).compile();
    interceptor = unit;
    refreshPushTimezoneUseCase = unitRef.get(RefreshPushTimezone);
    refreshPushTimezoneUseCase.execute.mockResolvedValue(undefined);
  });

  afterEach(() => {
    interceptor.onModuleDestroy();
    vi.useRealTimers();
  });

  it("인증 유저 + 유효한 X-Timezone이면 자가치유를 호출한다", () => {
    interceptor.intercept(
      contextFor({ userId: "u1" }, { "x-timezone": "Asia/Seoul" }),
      nextHandler,
    );

    expect(refreshPushTimezoneUseCase.execute).toHaveBeenCalledWith({
      userId: "u1",
      timezone: "Asia/Seoul",
    });
  });

  it("미인증(user 없음)이면 호출하지 않는다", () => {
    interceptor.intercept(contextFor(undefined, { "x-timezone": "Asia/Seoul" }), nextHandler);

    expect(refreshPushTimezoneUseCase.execute).not.toHaveBeenCalled();
  });

  it("무효/누락 타임존 헤더면 호출하지 않는다", () => {
    interceptor.intercept(contextFor({ userId: "u1" }, {}), nextHandler);
    interceptor.intercept(
      contextFor({ userId: "u1" }, { "x-timezone": "Mars/Olympus" }),
      nextHandler,
    );

    expect(refreshPushTimezoneUseCase.execute).not.toHaveBeenCalled();
  });

  it("같은 tz는 스로틀 창 안에서 한 번만 호출한다", () => {
    const ctx = contextFor({ userId: "u1" }, { "x-timezone": "Asia/Seoul" });

    interceptor.intercept(ctx, nextHandler);
    interceptor.intercept(ctx, nextHandler);

    expect(refreshPushTimezoneUseCase.execute).toHaveBeenCalledTimes(1);
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

    expect(refreshPushTimezoneUseCase.execute).toHaveBeenCalledTimes(2);
    expect(refreshPushTimezoneUseCase.execute).toHaveBeenLastCalledWith({
      userId: "u1",
      timezone: "America/New_York",
    });
  });
  it("타임존 저장에 실패하면 같은 타임존의 다음 요청에서 다시 시도한다", async () => {
    // Given
    const context = contextFor({ userId: "u1" }, { "x-timezone": "Asia/Seoul" });
    refreshPushTimezoneUseCase.execute.mockRejectedValueOnce(new Error("민감한 요청 원문"));
    // When
    interceptor.intercept(context, nextHandler);
    await Promise.resolve();
    interceptor.intercept(context, nextHandler);
    // Then
    expect(refreshPushTimezoneUseCase.execute).toHaveBeenCalledTimes(2);
    expect(Logger.prototype.error).toHaveBeenCalledWith({
      event: IdentitySettingsLogEvent.TIMEZONE_HEAL_FAILED,
      userId: "u1",
      timezone: "Asia/Seoul",
      errorName: "Error",
    });
    expect(JSON.stringify(vi.mocked(Logger.prototype.error).mock.calls)).not.toContain(
      "민감한 요청 원문",
    );
  });

  it("이전 타임존의 늦은 실패가 여행 후 성공한 새 타임존의 스로틀을 지우지 않는다", async () => {
    // Given
    const pendingSeoul = Promise.withResolvers<void>();
    refreshPushTimezoneUseCase.execute.mockReturnValueOnce(pendingSeoul.promise);
    const tokyo = contextFor({ userId: "u1" }, { "x-timezone": "Asia/Tokyo" });
    // When
    interceptor.intercept(
      contextFor({ userId: "u1" }, { "x-timezone": "Asia/Seoul" }),
      nextHandler,
    );
    interceptor.intercept(tokyo, nextHandler);
    pendingSeoul.reject(new Error("이전 요청의 저장 실패"));
    await Promise.resolve();
    interceptor.intercept(tokyo, nextHandler);
    // Then
    expect(refreshPushTimezoneUseCase.execute).toHaveBeenCalledTimes(2);
  });

  it("같은 타임존은 스로틀 만료 직전까지 생략하고 정확한 만료 시점에 다시 반영한다", () => {
    // Given
    const context = contextFor({ userId: "u1" }, { "x-timezone": "Asia/Seoul" });
    interceptor.intercept(context, nextHandler);
    // When
    vi.advanceTimersByTime(TimezoneSelfHealInterceptor.THROTTLE_MS - 1);
    interceptor.intercept(context, nextHandler);
    expect(refreshPushTimezoneUseCase.execute).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    interceptor.intercept(context, nextHandler);
    // Then
    expect(refreshPushTimezoneUseCase.execute).toHaveBeenCalledTimes(2);
  });

  it("빈 사용자 ID는 기존과 동일하게 timezone 저장 요청을 보내지 않는다", () => {
    // Given
    const context = contextFor({ userId: "" }, { "x-timezone": "Asia/Seoul" });
    // When
    interceptor.intercept(context, nextHandler);
    // Then
    expect(refreshPushTimezoneUseCase.execute).not.toHaveBeenCalled();
  });
});
