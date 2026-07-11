/**
 * DailyCompletionCacheInvalidator 단위 테스트
 *
 * Suites + GWT 패턴 — 투두 쓰기 이벤트 수신 시 캐시 무효화와 실패 삼킴 검증
 */

import { Logger } from "@nestjs/common";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoCreatedEvent, TodoToggledEvent } from "@/todo";
import {
	DAILY_COMPLETION_CACHE,
	type DailyCompletionCachePort,
} from "../ports/daily-completion-cache.port";
import { DailyCompletionCacheInvalidator } from "./daily-completion-cache.invalidator";

describe("DailyCompletionCacheInvalidator — 투두 쓰기 이벤트 캐시 무효화", () => {
	let invalidator: DailyCompletionCacheInvalidator;
	let cache: Mocked<DailyCompletionCachePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			DailyCompletionCacheInvalidator,
		)
			.mock<DailyCompletionCachePort>(DAILY_COMPLETION_CACHE)
			.impl(() => ({
				getRange: jest.fn(),
				setRange: jest.fn(),
				invalidate: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		invalidator = unit;
		cache = unitRef.get<DailyCompletionCachePort>(DAILY_COMPLETION_CACHE);
	});

	it("투두 생성 이벤트를 받으면 해당 사용자 캐시를 무효화한다", async () => {
		// Given
		const event = new TodoCreatedEvent(1, "user-123", null);

		// When
		await invalidator.handle(event);

		// Then
		expect(cache.invalidate).toHaveBeenCalledWith("user-123");
	});

	it("투두 토글 이벤트도 동일하게 무효화한다", async () => {
		// Given
		const event = new TodoToggledEvent(2, "user-456", true, "Asia/Seoul");

		// When
		await invalidator.handle(event);

		// Then
		expect(cache.invalidate).toHaveBeenCalledWith("user-456");
	});

	it("캐시 무효화 실패는 삼키고 로깅한다 (fire-and-forget)", async () => {
		// Given - 캐시 무효화 실패
		const errorSpy = jest
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		cache.invalidate.mockRejectedValue(new Error("redis down"));

		// When & Then - 예외를 전파하지 않는다
		await expect(
			invalidator.handle(new TodoCreatedEvent(1, "user-123", null)),
		).resolves.toBeUndefined();
		expect(errorSpy).toHaveBeenCalled();

		errorSpy.mockRestore();
	});
});
