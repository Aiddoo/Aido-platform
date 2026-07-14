import type { RetentionStageName } from "../retention.constants";

export interface RetentionMessage {
	readonly title: string;
	readonly body: string;
}

export function buildRetentionMessage(
	stage: RetentionStageName,
	variantId: string,
	locale: "ko" | "en",
): RetentionMessage {
	const key = `${stage}:${variantId}`;
	const korean: Record<string, RetentionMessage> = {
		"D0:d0_no_todo": {
			title: "첫 할 일을 가볍게 시작해보세요",
			body: "지금 떠오르는 한 가지를 적으면 오늘이 훨씬 선명해져요.",
		},
		"D1:d1_no_todo": {
			title: "오늘 할 일 하나만 정해볼까요?",
			body: "작은 계획 하나가 다시 시작하는 가장 쉬운 방법이에요.",
		},
		"D1:d1_has_todo_no_completion": {
			title: "어제 적은 일, 하나만 끝내보세요",
			body: "가장 쉬운 할 일부터 완료하면 흐름을 만들 수 있어요.",
		},
		"D3:d3_restart": {
			title: "계획은 언제든 다시 시작할 수 있어요",
			body: "오늘 필요한 일 하나만 새로 정리해보세요.",
		},
		"D7:d7_has_progress": {
			title: "첫 주의 기록이 쌓였어요",
			body: "이번 주에 만든 변화를 확인해보세요.",
		},
		"D7:d7_restart": {
			title: "이번 주, 한 가지부터 다시 시작해요",
			body: "지금 필요한 할 일 하나를 적어두면 충분해요.",
		},
	};
	const english: Record<string, RetentionMessage> = {
		"D0:d0_no_todo": {
			title: "Start with one small task",
			body: "Write down one thing on your mind and make today clearer.",
		},
		"D1:d1_no_todo": {
			title: "Pick one task for today",
			body: "One small plan is the easiest way to get started.",
		},
		"D1:d1_has_todo_no_completion": {
			title: "Finish just one task",
			body: "Start with the easiest one and build momentum.",
		},
		"D3:d3_restart": {
			title: "You can restart any time",
			body: "Add one thing that matters today.",
		},
		"D7:d7_has_progress": {
			title: "Your first week is taking shape",
			body: "See the progress you made this week.",
		},
		"D7:d7_restart": {
			title: "Restart this week with one thing",
			body: "Writing down one task is enough to begin.",
		},
	};
	const fallback =
		locale === "en" ? english["D3:d3_restart"] : korean["D3:d3_restart"];
	return (
		(locale === "en" ? english[key] : korean[key]) ??
		fallback ?? {
			title: "Aido",
			body: "Open Aido to plan your day.",
		}
	);
}
