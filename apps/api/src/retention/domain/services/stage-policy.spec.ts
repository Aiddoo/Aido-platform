import { decideRetentionStage } from "./stage-policy";

describe("decideRetentionStage — D7 리텐션 단계 정책", () => {
	const base = {
		startedAt: new Date("2026-07-15T00:00:00.000Z"),
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
				now: new Date("2026-07-15T01:59:00.000Z"),
			}),
		).toEqual({ kind: "WAIT" });
		expect(
			decideRetentionStage("D0", {
				...base,
				now: new Date("2026-07-15T02:00:00.000Z"),
			}),
		).toEqual({ kind: "SEND", route: "/feed", variantId: "d0_no_todo" });
	});

	it("D0가 다음 로컬 날짜로 넘어가면 D1과 충돌하지 않도록 스킵한다", () => {
		expect(
			decideRetentionStage("D0", {
				...base,
				now: new Date("2026-07-15T15:01:00.000Z"),
			}),
		).toEqual({ kind: "SKIP", reason: "D0_COLLIDES_WITH_D1" });
	});

	it("D1은 현지 10시 30분 이후 상태에 맞는 고정 variant를 선택한다", () => {
		expect(
			decideRetentionStage("D1", {
				...base,
				now: new Date("2026-07-16T01:30:00.000Z"),
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
				now: new Date("2026-07-22T01:30:00.000Z"),
				activeToday: true,
			}),
		).toEqual({ kind: "EVALUATE_ONLY", reason: "ACTIVE_ON_D7" });
	});
});
