import { Logger } from "@nestjs/common";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";

import { TODO_CATEGORY_EVENTS } from "#api/modules/planning/planning-categories.public";
import { TODO_EVENTS, TodoCreatedEvent } from "#api/modules/planning/planning-todos.public";
import { createInsightsFixture, INSIGHTS_TIME } from "#test/fixtures/insights.fixture";

import { InsightsLogEvent } from "../../../application/observability/insights-log.events.js";
import { DAILY_COMPLETION_CACHE } from "../../../application/ports/daily-completions/daily-completion-cache.port.js";
import { DailyCompletionCacheInvalidator } from "./daily-completion-cache.invalidator.js";

const sourceEvents = [
  TODO_EVENTS.CREATED,
  TODO_EVENTS.DELETED,
  TODO_EVENTS.TOGGLED,
  TODO_EVENTS.RESCHEDULED,
  TODO_EVENTS.UPDATED,
  TODO_EVENTS.CATEGORY_CHANGED,
  TODO_EVENTS.VISIBILITY_CHANGED,
  TODO_CATEGORY_EVENTS.UPDATED,
  TODO_CATEGORY_EVENTS.DELETED,
];
const RANGE = { startDate: "2028-02-29", endDate: "2028-02-29" };
const EMPTY_RANGE = { completions: [], totalCompleteDays: 0, dateRange: RANGE };

describe("DailyCompletionCacheInvalidator", () => {
  let module: TestingModule | undefined;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INSIGHTS_TIME);
  });
  afterEach(async () => {
    try {
      await module?.close();
    } finally {
      module = undefined;
      vi.useRealTimers();
    }
  });

  it.each(sourceEvents)(
    "%s 이벤트가 소유자의 일반·공개 집계를 함께 무효화한다",
    async (eventName) => {
      // Given
      const fixture = createInsightsFixture();
      await fixture.cache.storeRangeIfCurrent(
        fixture.userId,
        RANGE.startDate,
        RANGE.endDate,
        "0",
        EMPTY_RANGE,
      );
      await fixture.cache.storePublicRangeIfCurrent(
        fixture.userId,
        RANGE.startDate,
        RANGE.endDate,
        "0",
        EMPTY_RANGE,
      );
      await fixture.cache.storeRangeIfCurrent(
        fixture.viewerId,
        RANGE.startDate,
        RANGE.endDate,
        "0",
        EMPTY_RANGE,
      );
      module = await Test.createTestingModule({
        imports: [EventEmitterModule.forRoot()],
        providers: [
          DailyCompletionCacheInvalidator,
          { provide: DAILY_COMPLETION_CACHE, useValue: fixture.cache },
        ],
      }).compile();
      await module.init();
      const emitter = module.get(EventEmitter2);
      // When
      await emitter.emitAsync(eventName, { userId: fixture.userId });
      // Then
      expect(
        (await fixture.cache.readRange(fixture.userId, RANGE.startDate, RANGE.endDate)).value,
      ).toBeUndefined();
      expect(
        (await fixture.cache.readPublicRange(fixture.userId, RANGE.startDate, RANGE.endDate)).value,
      ).toBeUndefined();
      expect(
        (await fixture.cache.readRange(fixture.viewerId, RANGE.startDate, RANGE.endDate)).value,
      ).toEqual(EMPTY_RANGE);
    },
  );

  it("무효화 실패가 이벤트 발행으로 전파되지 않고 원문 없이 실패 맥락을 기록한다", async () => {
    // Given
    const fixture = createInsightsFixture();
    vi.spyOn(fixture.cache, "invalidate").mockRejectedValueOnce(new Error("private cache payload"));
    const warning = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const invalidator = new DailyCompletionCacheInvalidator(fixture.cache);
    // When, Then
    await expect(
      invalidator.handle(new TodoCreatedEvent(1, fixture.userId, null)),
    ).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith({
      event: InsightsLogEvent.DAILY_COMPLETION_CACHE_INVALIDATION_FAILED,
      userId: fixture.userId,
      errorType: "Error",
    });
  });
});
