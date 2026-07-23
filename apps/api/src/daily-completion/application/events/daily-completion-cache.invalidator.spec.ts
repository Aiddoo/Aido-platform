/**
 * DailyCompletionCacheInvalidator 단위 테스트
 *
 * Suites + GWT 패턴 — 투두 쓰기 이벤트 수신 시 캐시 무효화와 실패 삼킴 검증
 */

import { Logger } from "@nestjs/common";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	TODO_EVENTS,
	TodoCategoryChangedEvent,
	TodoCreatedEvent,
	TodoToggledEvent,
} from "@/todo";
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

	it("6개 투두 쓰기 이벤트를 각각 개별 구독한다 (배열 인자는 결합된 단일 이벤트명이 되므로 회귀 방지)", () => {
		// Given - @OnEvent가 남긴 메타데이터 (@nestjs/event-emitter 공개 상수)
		const eventListenerMetadata: unknown = Reflect.getMetadata(
			// EVENT_LISTENER_METADATA — 데코레이터가 handle 메서드에 기록하는 키
			"EVENT_LISTENER_METADATA",
			DailyCompletionCacheInvalidator.prototype.handle,
		);

		// When - 구독된 이벤트명 목록 추출
		const subscribed = Array.isArray(eventListenerMetadata)
			? eventListenerMetadata.map((m: { event: string }) => m.event)
			: [];

		// Then - 6개 이벤트가 문자열로 각각 구독되어야 한다
		expect(subscribed.sort()).toEqual(
			[
				TODO_EVENTS.CREATED,
				TODO_EVENTS.DELETED,
				TODO_EVENTS.TOGGLED,
				TODO_EVENTS.RESCHEDULED,
				TODO_EVENTS.UPDATED,
				TODO_EVENTS.CATEGORY_CHANGED,
			].sort(),
		);
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

	it("카테고리 변경 이벤트도 동일하게 무효화한다 (캘린더 색상 스테일 방지)", async () => {
		// Given
		const event = new TodoCategoryChangedEvent(3, "user-789", 2);

		// When
		await invalidator.handle(event);

		// Then
		expect(cache.invalidate).toHaveBeenCalledWith("user-789");
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
