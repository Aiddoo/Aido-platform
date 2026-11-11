import { decideRetentionStage, isRetentionStageDue } from "./retention-stage.domain-service.js";

describe("decideRetentionStage — D7 리텐션 단계 정책", () => {
  const base = {
    startedAt: Temporal.Instant.from("2026-07-15T00:00:00.000Z"),
    timezone: "Asia/Seoul",
    todoCount: 0,
    completedCount: 0,
    incompleteCount: 0,
    returnedWithinWindow: false,
    todoActionWithinWindow: false,
    activeToday: false,
  };

  it("D0는 가입 2시간 전에는 기다리고 이후 Todo가 없을 때만 발송한다", () => {
    expect(
      decideRetentionStage("D0", {
        ...base,
        now: Temporal.Instant.from("2026-07-15T01:59:00.000Z"),
      }),
    ).toEqual({ kind: "WAIT" });
    expect(
      decideRetentionStage("D0", {
        ...base,
        now: Temporal.Instant.from("2026-07-15T02:00:00.000Z"),
      }),
    ).toEqual({ kind: "SEND", route: "/feed", variantId: "d0_no_todo" });
  });

  it("D0가 다음 로컬 날짜로 넘어가면 D1과 충돌하지 않도록 스킵한다", () => {
    expect(
      decideRetentionStage("D0", {
        ...base,
        now: Temporal.Instant.from("2026-07-15T15:01:00.000Z"),
      }),
    ).toEqual({ kind: "SKIP", reason: "D0_COLLIDES_WITH_D1" });
  });

  it("D1은 현지 10시 30분 이후 상태에 맞는 고정 variant를 선택한다", () => {
    expect(
      decideRetentionStage("D1", {
        ...base,
        now: Temporal.Instant.from("2026-07-16T01:30:00.000Z"),
        todoCount: 1,
        incompleteCount: 1,
      }),
    ).toEqual({
      kind: "SEND",
      route: "/feed",
      variantId: "d1_has_todo_no_completion",
    });
  });

  it("D7 당일 이미 활동했으면 발송 없이 측정만 한다", () => {
    expect(
      decideRetentionStage("D7", {
        ...base,
        now: Temporal.Instant.from("2026-07-22T01:30:00.000Z"),
        activeToday: true,
      }),
    ).toEqual({ kind: "EVALUATE_ONLY", reason: "ACTIVE_ON_D7" });
  });

  describe("isRetentionStageDue — 결정할 때가 된 단계", () => {
    const startedAt = Temporal.Instant.from("2026-07-15T00:00:00.000Z");

    it.each([
      ["D0", "2026-07-15T01:59:59.999Z", false],
      ["D0", "2026-07-15T02:00:00.000Z", true],
      ["D1", "2026-07-16T01:29:00.000Z", false],
      ["D1", "2026-07-16T01:30:00.000Z", true],
      ["D3", "2026-07-17T23:00:00.000Z", false],
      ["D7", "2026-07-23T00:00:00.000Z", true],
    ] as const)("Asia/Seoul %s는 %s에 %s다", (stage, now, due) => {
      expect(
        isRetentionStageDue(stage, {
          startedAt,
          now: Temporal.Instant.from(now),
          timezone: "Asia/Seoul",
        }),
      ).toBe(due);
    });

    it("D0는 2시간 전이라도 현지 날짜가 바뀌었으면 건너뛰도록 결정 대상이다", () => {
      // Given: 현지 23:30 가입, 30분 뒤 자정을 넘김
      const lateSignup = Temporal.Instant.from("2026-07-15T14:30:00.000Z");

      // When / Then
      expect(
        isRetentionStageDue("D0", {
          startedAt: lateSignup,
          now: Temporal.Instant.from("2026-07-15T15:00:00.000Z"),
          timezone: "Asia/Seoul",
        }),
      ).toBe(true);
    });
  });
});
