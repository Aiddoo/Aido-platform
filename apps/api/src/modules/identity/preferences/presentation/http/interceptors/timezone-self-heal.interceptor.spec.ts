import type { IncomingHttpHeaders } from "node:http";

import { Logger, type LoggerService } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { of } from "rxjs";

import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createUserSettingsFixture } from "#test/fixtures/user-settings.fixture";
import { createRequestClientReader, runWithRequestHeaders } from "#test/mocks/request-client";

import { PreferenceLogEvent } from "../../../application/preferences.log-events.js";
import {
  type RefreshPushTimezoneCommand,
  RefreshPushTimezoneUseCase,
} from "../../../application/use-cases/refresh-push-timezone.use-case.js";
import {
  TIMEZONE_SELF_HEAL_MAX_ENTRIES,
  TIMEZONE_SELF_HEAL_TTL_MS,
  TimezoneSelfHealInterceptor,
} from "./timezone-self-heal.interceptor.js";

class RecordingRefreshPushTimezone extends RefreshPushTimezoneUseCase {
  readonly commands: RefreshPushTimezoneCommand[] = [];
  readonly #outcomes: Array<() => Promise<void>> = [];

  constructor() {
    super(createUserSettingsFixture());
  }

  thenSettle(...outcomes: Array<() => Promise<void>>): void {
    this.#outcomes.push(...outcomes);
  }

  // 인터셉터가 붙이는 catch가 바로 다음 tick에 돌도록 async로 감싸지 않는다
  override execute(command: RefreshPushTimezoneCommand): Promise<void> {
    this.commands.push(command);
    return this.#outcomes.shift()?.() ?? Promise.resolve();
  }
}

// 인터셉터는 Nest Logger를 직접 만들므로 Nest가 정한 교체 지점(overrideLogger)으로 남긴 로그를 모은다
class RecordingNestLogger implements LoggerService {
  readonly errors: unknown[] = [];
  readonly others: unknown[] = [];

  log(message: unknown): void {
    this.others.push(message);
  }

  warn(message: unknown): void {
    this.others.push(message);
  }

  debug(message: unknown): void {
    this.others.push(message);
  }

  error(message: unknown): void {
    this.errors.push(message);
  }
}

describe("TimezoneSelfHealInterceptor", () => {
  let refresh: RecordingRefreshPushTimezone;
  let clock: FixedClock;
  let nestLogger: RecordingNestLogger;
  let interceptor: TimezoneSelfHealInterceptor;

  beforeEach(() => {
    refresh = new RecordingRefreshPushTimezone();
    clock = new FixedClock(Temporal.Instant.from("2026-01-16T09:00:00.000Z"));
    nestLogger = new RecordingNestLogger();
    Logger.overrideLogger(nestLogger);
    interceptor = new TimezoneSelfHealInterceptor(refresh, createRequestClientReader(), clock);
  });

  const intercept = (userId: string | undefined, headers: IncomingHttpHeaders) =>
    runWithRequestHeaders(headers, () =>
      interceptor.intercept(
        new ExecutionContextHost([{ user: userId == null ? undefined : { userId } }, {}]),
        { handle: () => of("ok") },
      ),
    );

  it("인증 유저 + 유효한 X-Timezone이면 자가치유를 요청한다", () => {
    // When
    intercept("u1", { "x-timezone": "Asia/Seoul" });

    // Then
    expect(refresh.commands).toEqual([{ userId: "u1", timezone: "Asia/Seoul" }]);
  });

  it("미인증(user 없음)이면 요청하지 않는다", () => {
    // When
    intercept(undefined, { "x-timezone": "Asia/Seoul" });

    // Then
    expect(refresh.commands).toEqual([]);
  });

  it("무효/누락 타임존 헤더면 요청하지 않는다", () => {
    // When
    intercept("u1", {});
    intercept("u1", { "x-timezone": "Mars/Olympus" });

    // Then
    expect(refresh.commands).toEqual([]);
  });

  it("같은 tz는 스로틀 창 안에서 한 번만 요청한다", () => {
    // When
    intercept("u1", { "x-timezone": "Asia/Seoul" });
    intercept("u1", { "x-timezone": "Asia/Seoul" });

    // Then
    expect(refresh.commands).toEqual([{ userId: "u1", timezone: "Asia/Seoul" }]);
  });

  it("tz가 바뀌면 즉시 다시 요청한다 (여행 등)", () => {
    // When
    intercept("u1", { "x-timezone": "Asia/Seoul" });
    intercept("u1", { "x-timezone": "America/New_York" });

    // Then
    expect(refresh.commands).toEqual([
      { userId: "u1", timezone: "Asia/Seoul" },
      { userId: "u1", timezone: "America/New_York" },
    ]);
  });

  it("기기 두 대가 번갈아 요청하면 스로틀에 막히지 않고 마지막 요청의 시간대를 반영한다", () => {
    // Given
    const phone = { "x-timezone": "America/New_York" };
    const tablet = { "x-timezone": "Asia/Seoul" };

    // When
    intercept("u1", phone);
    intercept("u1", tablet);
    intercept("u1", phone);

    // Then
    expect(refresh.commands.map((command) => command.timezone)).toEqual([
      "America/New_York",
      "Asia/Seoul",
      "America/New_York",
    ]);
  });

  it("타임존 저장에 실패하면 같은 타임존의 다음 요청에서 다시 시도한다", async () => {
    // Given
    const headers = { "x-timezone": "Asia/Seoul" };
    refresh.thenSettle(() => Promise.reject(new Error("민감한 요청 원문")));

    // When
    intercept("u1", headers);
    await Promise.resolve();
    intercept("u1", headers);

    // Then
    expect(refresh.commands).toHaveLength(2);
    expect(nestLogger.errors).toEqual([
      {
        event: PreferenceLogEvent.TIMEZONE_HEAL_FAILED,
        userId: "u1",
        timezone: "Asia/Seoul",
        errorType: "Error",
      },
    ]);
    expect(JSON.stringify(nestLogger.errors)).not.toContain("민감한 요청 원문");
  });

  it("이전 타임존의 늦은 실패가 여행 후 성공한 새 타임존의 스로틀을 지우지 않는다", async () => {
    // Given
    const pendingSeoul = Promise.withResolvers<void>();
    refresh.thenSettle(() => pendingSeoul.promise);
    const tokyo = { "x-timezone": "Asia/Tokyo" };

    // When
    intercept("u1", { "x-timezone": "Asia/Seoul" });
    intercept("u1", tokyo);
    pendingSeoul.reject(new Error("이전 요청의 저장 실패"));
    await Promise.resolve();
    intercept("u1", tokyo);

    // Then
    expect(refresh.commands.map((command) => command.timezone)).toEqual([
      "Asia/Seoul",
      "Asia/Tokyo",
    ]);
  });

  it("같은 타임존은 스로틀 만료 직전까지 생략하고 정확한 만료 시점에 다시 반영한다", () => {
    // Given
    const headers = { "x-timezone": "Asia/Seoul" };
    intercept("u1", headers);

    // When
    clock.advanceBy({ milliseconds: TIMEZONE_SELF_HEAL_TTL_MS - 1 });
    intercept("u1", headers);
    const beforeExpiry = refresh.commands.length;
    clock.advanceBy({ milliseconds: 1 });
    intercept("u1", headers);

    // Then
    expect(beforeExpiry).toBe(1);
    expect(refresh.commands).toHaveLength(2);
  });

  it("빈 사용자 ID는 기존과 동일하게 timezone 저장 요청을 보내지 않는다", () => {
    // When
    intercept("", { "x-timezone": "Asia/Seoul" });

    // Then
    expect(refresh.commands).toEqual([]);
  });

  it("스로틀 중인 사용자가 상한을 넘으면 가장 오래 안 본 사용자부터 잊어 크기를 상한 안에 둔다", () => {
    // Given
    const headers = { "x-timezone": "Asia/Seoul" };
    intercept("oldest", headers);
    for (let index = 0; index < TIMEZONE_SELF_HEAL_MAX_ENTRIES; index += 1) {
      intercept(`user-${index}`, headers);
    }
    const commandsBefore = refresh.commands.length;

    // When
    intercept(`user-${TIMEZONE_SELF_HEAL_MAX_ENTRIES - 1}`, headers);
    intercept("oldest", headers);

    // Then
    expect(refresh.commands.slice(commandsBefore)).toEqual([
      { userId: "oldest", timezone: "Asia/Seoul" },
    ]);
  });
});
