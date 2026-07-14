import type { RetentionStageName } from "../retention.constants";

export interface RetentionStageState {
	readonly startedAt: Date;
	readonly now: Date;
	readonly timezone: string;
	readonly todoCount: number;
	readonly completedCount: number;
	readonly incompleteCount: number;
	readonly returnedWithinWindow: boolean;
	readonly todoActionWithinWindow: boolean;
	readonly activeToday: boolean;
}

export type RetentionStageDecision =
	| { readonly kind: "WAIT" }
	| { readonly kind: "SKIP"; readonly reason: string }
	| {
			readonly kind: "SEND";
			readonly route: "/feed" | "/achievements";
			readonly variantId: string;
	  }
	| { readonly kind: "EVALUATE_ONLY"; readonly reason: string };

export function decideRetentionStage(
	stage: RetentionStageName,
	state: RetentionStageState,
): RetentionStageDecision {
	const day = localDayDifference(state.startedAt, state.now, state.timezone);

	if (stage === "D0") {
		if (day > 0) return { kind: "SKIP", reason: "D0_COLLIDES_WITH_D1" };
		if (state.now.getTime() - state.startedAt.getTime() < 2 * 60 * 60 * 1000) {
			return { kind: "WAIT" };
		}
		return state.todoCount === 0
			? { kind: "SEND", route: "/feed", variantId: "d0_no_todo" }
			: { kind: "SKIP", reason: "TODO_ALREADY_CREATED" };
	}

	const targetDay = stage === "D1" ? 1 : stage === "D3" ? 3 : 7;
	if (day < targetDay) return { kind: "WAIT" };
	if (day > targetDay) {
		return stage === "D7"
			? { kind: "EVALUATE_ONLY", reason: "D7_SEND_WINDOW_MISSED" }
			: { kind: "SKIP", reason: `${stage}_SEND_WINDOW_MISSED` };
	}
	if (!isAtOrAfterLocalTime(state.now, state.timezone, 10, 30)) {
		return { kind: "WAIT" };
	}

	if (stage === "D1") {
		if (state.todoCount === 0) {
			return { kind: "SEND", route: "/feed", variantId: "d1_no_todo" };
		}
		if (state.incompleteCount > 0 && state.completedCount === 0) {
			return {
				kind: "SEND",
				route: "/feed",
				variantId: "d1_has_todo_no_completion",
			};
		}
		return { kind: "SKIP", reason: "ACTIVATED_BEFORE_D1" };
	}

	if (stage === "D3") {
		return state.returnedWithinWindow && state.todoActionWithinWindow
			? { kind: "SKIP", reason: "ACTIVE_BEFORE_D3" }
			: { kind: "SEND", route: "/feed", variantId: "d3_restart" };
	}

	if (state.activeToday) {
		return { kind: "EVALUATE_ONLY", reason: "ACTIVE_ON_D7" };
	}
	return state.todoActionWithinWindow
		? {
				kind: "SEND",
				route: "/achievements",
				variantId: "d7_has_progress",
			}
		: { kind: "SEND", route: "/feed", variantId: "d7_restart" };
}

function localDayDifference(from: Date, to: Date, timezone: string): number {
	const fromDate = localDateString(from, timezone);
	const toDate = localDateString(to, timezone);
	return Math.floor(
		(Date.parse(`${toDate}T00:00:00.000Z`) -
			Date.parse(`${fromDate}T00:00:00.000Z`)) /
			86_400_000,
	);
}

export function localDateString(date: Date, timezone: string): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value ?? "1970";
	const month = parts.find((part) => part.type === "month")?.value ?? "01";
	const day = parts.find((part) => part.type === "day")?.value ?? "01";
	return `${year}-${month}-${day}`;
}

function isAtOrAfterLocalTime(
	date: Date,
	timezone: string,
	hour: number,
	minute: number,
): boolean {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const localHour = Number(
		parts.find((part) => part.type === "hour")?.value ?? 0,
	);
	const localMinute = Number(
		parts.find((part) => part.type === "minute")?.value ?? 0,
	);
	return localHour > hour || (localHour === hour && localMinute >= minute);
}
