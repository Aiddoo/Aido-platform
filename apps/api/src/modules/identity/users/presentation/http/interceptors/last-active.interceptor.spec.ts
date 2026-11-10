import type { IncomingHttpHeaders } from "node:http";

import type { CurrentUserPayload } from "@aido/api";
import { Logger } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { of } from "rxjs";

import { AuthUserActivityWriterPort } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createRequestClientReader, runWithRequestHeaders } from "#test/mocks/request-client";

import {
  LAST_ACTIVE_THROTTLE_MAX_ENTRIES,
  LastActiveInterceptor,
} from "./last-active.interceptor.js";

class RecordingActivityWriter extends AuthUserActivityWriterPort {
  readonly writes: Array<[userId: string, timezone: string, appVersion: string | undefined]> = [];
  readonly #outcomes: Array<() => Promise<void>> = [];

  thenSettle(...outcomes: Array<() => Promise<void>>): void {
    this.#outcomes.push(...outcomes);
  }

  // 인터셉터가 붙이는 catch가 바로 다음 tick에 돌도록 async로 감싸지 않는다
  updateLastActiveAt(activity: {
    readonly userId: string;
    readonly timezone: string;
    readonly seenAt: Temporal.Instant;
    readonly appVersion?: string;
  }): Promise<void> {
    this.writes.push([activity.userId, activity.timezone, activity.appVersion]);
    return this.#outcomes.shift()?.() ?? Promise.resolve();
  }
}

function userOf(name: string): CurrentUserPayload {
  return {
    userId: `user-${name}`,
    email: `${name}@example.com`,
    sessionId: `session-${name}`,
    role: "USER",
  };
}

describe("LastActiveInterceptor — 사용자 활동 기록", () => {
  let activityWriter: RecordingActivityWriter;
  let clock: FixedClock;
  let interceptor: LastActiveInterceptor;

  beforeAll(() => {
    // 저장 실패 로그를 테스트 출력에 남기지 않는다(vitest는 spec 파일마다 모듈을 새로 읽는다)
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    activityWriter = new RecordingActivityWriter();
    clock = new FixedClock(Temporal.Instant.from("2026-07-26T03:00:00Z"));
    interceptor = new LastActiveInterceptor(activityWriter, createRequestClientReader(), clock);
  });

  const intercept = (user: CurrentUserPayload, headers: IncomingHttpHeaders = {}) =>
    runWithRequestHeaders(headers, () =>
      interceptor.intercept(new ExecutionContextHost([{ user }, {}]), { handle: () => of("ok") }),
    );

  it("X-Timezone을 정규 IANA 타임존으로 변환해 활동 writer에 전달한다", () => {
    // Given
    const user = userOf("1");

    // When
    intercept(user, { "x-timezone": "US/Eastern" });

    // Then
    expect(activityWriter.writes).toEqual([["user-1", "America/New_York", undefined]]);
  });

  it("기존 클라이언트가 X-Timezone을 보내지 않으면 UTC로 기록한다", () => {
    // Given
    const user = userOf("legacy");

    // When
    intercept(user);

    // Then
    expect(activityWriter.writes).toEqual([["user-legacy", "UTC", undefined]]);
  });

  it("같은 사용자의 한 시간 내 요청은 기존처럼 한 번만 기록한다", () => {
    // Given
    const user = userOf("throttled");

    // When
    intercept(user, { "x-timezone": "Asia/Seoul" });
    intercept(user, { "x-timezone": "Asia/Seoul" });

    // Then
    expect(activityWriter.writes).toEqual([["user-throttled", "Asia/Seoul", undefined]]);
  });

  it("SemVer 앱 버전은 함께 남기고, 한 시간 이내라도 버전이 바뀌면 바로 남긴다", () => {
    // Given
    const user = userOf("upgraded");
    const appVersions = ["1.12.1", "1.12.1", "1.13.0", "dev-build"];

    // When
    for (const appVersion of appVersions) {
      intercept(user, { "x-timezone": "Asia/Seoul", "x-app-version": appVersion });
    }

    // Then
    expect(activityWriter.writes).toEqual([
      ["user-upgraded", "Asia/Seoul", "1.12.1"],
      ["user-upgraded", "Asia/Seoul", "1.13.0"],
      ["user-upgraded", "Asia/Seoul", undefined],
    ]);
  });

  it("한 시간 이내라도 사용자 현지 날짜가 바뀌면 새 활동일을 기록한다", () => {
    // Given
    const user = userOf("midnight");
    clock.advanceBy(Temporal.Instant.from("2026-07-26T14:59:00.000Z").since(clock.now()));

    // When
    intercept(user, { "x-timezone": "Asia/Seoul" });
    clock.advanceBy({ minutes: 2 });
    intercept(user, { "x-timezone": "Asia/Seoul" });

    // Then
    expect(activityWriter.writes).toHaveLength(2);
  });

  it("활동 저장이 실패하면 같은 현지 날짜의 다음 요청이 재시도한다", async () => {
    // Given
    const user = userOf("retry");
    activityWriter.thenSettle(() => Promise.reject(new Error("database unavailable")));

    // When
    intercept(user, { "x-timezone": "Asia/Seoul" });
    await Promise.resolve();
    await Promise.resolve();
    intercept(user, { "x-timezone": "Asia/Seoul" });

    // Then
    expect(activityWriter.writes).toHaveLength(2);
  });

  it("이전 현지 날짜 저장 실패가 새 현지 날짜의 throttle을 지우지 않는다", async () => {
    // Given
    const user = userOf("stale-failure");
    let rejectFirst: (reason: Error) => void = () => undefined;
    const firstWrite = new Promise<void>((_resolve, reject) => {
      rejectFirst = reject;
    });
    activityWriter.thenSettle(() => firstWrite);
    clock.advanceBy(Temporal.Instant.from("2026-07-26T14:59:00.000Z").since(clock.now()));

    // When
    intercept(user, { "x-timezone": "Asia/Seoul" });
    clock.advanceBy({ minutes: 2 });
    intercept(user, { "x-timezone": "Asia/Seoul" });
    rejectFirst(new Error("late failure"));
    await Promise.resolve();
    await Promise.resolve();
    clock.advanceBy({ minutes: 1 });
    intercept(user, { "x-timezone": "Asia/Seoul" });

    // Then
    expect(activityWriter.writes).toHaveLength(2);
  });

  it("throttle 키가 상한을 넘으면 가장 오래 안 본 사용자부터 잊어 크기를 상한 안에 둔다", () => {
    // Given
    const headers = { "x-timezone": "Asia/Seoul" };
    intercept(userOf("oldest"), headers);
    for (let index = 0; index < LAST_ACTIVE_THROTTLE_MAX_ENTRIES; index += 1) {
      intercept(userOf(String(index)), headers);
    }
    const writesBefore = activityWriter.writes.length;

    // When
    intercept(userOf(String(LAST_ACTIVE_THROTTLE_MAX_ENTRIES - 1)), headers);
    intercept(userOf("oldest"), headers);

    // Then
    expect(activityWriter.writes.slice(writesBefore)).toEqual([
      ["user-oldest", "Asia/Seoul", undefined],
    ]);
  });
});
