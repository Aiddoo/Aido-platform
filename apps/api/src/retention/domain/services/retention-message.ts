import { deterministicIndex } from "@/shared/domain/services/deterministic-variant";
import type { RetentionStageName } from "../retention.constants";

export interface RetentionMessage {
	readonly title: string;
	readonly body: string;
	readonly variantId: string;
}

export interface RetentionMessageContext {
	readonly recipientId: string;
	/** 사용자 로컬 날짜(YYYY-MM-DD) */
	readonly occurrenceKey: string;
}

interface RetentionCopy {
	readonly title: string;
	readonly body: string;
}

const KOREAN_MESSAGES: Readonly<Record<string, readonly RetentionCopy[]>> = {
	"D0:d0_no_todo": [
		{
			title: "첫 할 일을 시작해볼까? 🌱",
			body: "지금 떠오르는 한 가지만 적어봐",
		},
		{
			title: "오늘의 첫 계획을 적어봐 ✍️",
			body: "작은 할 일 하나면 시작하기 충분해",
		},
		{
			title: "가볍게 하나부터 시작하자 ☀️",
			body: "오늘 꼭 하고 싶은 일을 적어봐",
		},
	],
	"D1:d1_no_todo": [
		{
			title: "오늘 할 일 하나만 정해볼까? 📝",
			body: "작은 계획 하나가 하루의 흐름을 만들어줘",
		},
		{
			title: "오늘은 무엇부터 해볼까? ☀️",
			body: "가장 쉬운 일 하나를 먼저 적어봐",
		},
		{
			title: "빈 목록에 첫 할 일을 더해봐 🌱",
			body: "하나만 정해도 오늘이 훨씬 선명해져",
		},
	],
	"D1:d1_has_todo_no_completion": [
		{
			title: "적어둔 일, 하나부터 시작하자 ✅",
			body: "가장 쉬운 할 일을 골라 완료해봐",
		},
		{
			title: "첫 완료를 만들어볼까? 🌱",
			body: "5분이면 되는 일부터 가볍게 시작해봐",
		},
		{
			title: "오늘의 첫 체크를 기다리는 중 👀",
			body: "작은 일 하나를 끝내면 흐름이 생겨",
		},
	],
	"D3:d3_restart": [
		{
			title: "오늘부터 다시 시작해도 돼 🌱",
			body: "지금 필요한 일 하나만 새로 적어봐",
		},
		{
			title: "계획은 언제든 다시 세울 수 있어 ✨",
			body: "오늘 할 수 있는 만큼만 시작하자",
		},
		{
			title: "가볍게 흐름을 다시 만들어보자 ☀️",
			body: "가장 쉬운 할 일 하나면 충분해",
		},
	],
	"D7:d7_has_progress": [
		{
			title: "첫 주의 기록이 쌓였어 🎉",
			body: "이번 주에 만든 변화를 확인해봐",
		},
		{
			title: "일주일 동안 만든 흐름이 보여 📊",
			body: "지금까지의 완료 기록을 살펴봐",
		},
		{
			title: "첫 주를 함께 달렸어 ✨",
			body: "네가 해낸 일들을 한눈에 확인해봐",
		},
	],
	"D7:d7_restart": [
		{
			title: "이번 주, 하나부터 다시 시작하자 🌱",
			body: "지금 필요한 할 일 하나만 적어봐",
		},
		{
			title: "새로운 한 주를 가볍게 열어봐 ☀️",
			body: "오늘 할 수 있는 일 하나면 충분해",
		},
		{
			title: "다시 시작하기 좋은 날이야 ✨",
			body: "부담 없이 작은 계획부터 세워보자",
		},
	],
};

const ENGLISH_MESSAGES: Readonly<Record<string, readonly RetentionCopy[]>> = {
	"D0:d0_no_todo": [
		{
			title: "Ready for your first task? 🌱",
			body: "Write down one thing on your mind",
		},
		{
			title: "Add your first plan ✍️",
			body: "One small task is enough to begin",
		},
		{
			title: "Start with one small thing ☀️",
			body: "Add what matters most today",
		},
	],
	"D1:d1_no_todo": [
		{
			title: "Pick one task for today 📝",
			body: "A small plan can shape your whole day",
		},
		{
			title: "What will you start with? ☀️",
			body: "Add the easiest thing on your mind",
		},
		{
			title: "Add the first task to your list 🌱",
			body: "One plan can make today feel clearer",
		},
	],
	"D1:d1_has_todo_no_completion": [
		{
			title: "Start with one task ✅",
			body: "Choose the easiest one and check it off",
		},
		{
			title: "Ready for your first check? 🌱",
			body: "Start with something that takes five minutes",
		},
		{
			title: "Your first check is waiting 👀",
			body: "Finishing one small thing builds momentum",
		},
	],
	"D3:d3_restart": [
		{
			title: "You can restart today 🌱",
			body: "Add one thing that matters right now",
		},
		{
			title: "Plans can always change ✨",
			body: "Start with what you can do today",
		},
		{
			title: "Build your rhythm again ☀️",
			body: "One easy task is enough to begin",
		},
	],
	"D7:d7_has_progress": [
		{
			title: "Your first week is taking shape 🎉",
			body: "See the progress you made this week",
		},
		{
			title: "Your weekly rhythm is visible 📊",
			body: "Review everything you checked off",
		},
		{
			title: "You made it through week one ✨",
			body: "See what you accomplished at a glance",
		},
	],
	"D7:d7_restart": [
		{
			title: "Restart this week with one thing 🌱",
			body: "Add the task you need most right now",
		},
		{
			title: "Open the week with a small plan ☀️",
			body: "One doable task is enough",
		},
		{
			title: "Today is a good day to restart ✨",
			body: "Begin with a plan that feels light",
		},
	],
};

export function buildRetentionMessage(
	stage: RetentionStageName,
	variantId: string,
	locale: "ko" | "en",
	context?: RetentionMessageContext,
): RetentionMessage {
	const key = `${stage}:${variantId}`;
	const catalog = locale === "en" ? ENGLISH_MESSAGES : KOREAN_MESSAGES;
	const fallback = catalog["D3:d3_restart"] ?? [];
	const pool = catalog[key] ?? fallback;
	const index = context
		? deterministicIndex(
				`${key}\u0000${context.recipientId}\u0000${context.occurrenceKey}`,
				pool.length,
			)
		: 0;
	const message = pool[index] ?? {
		title:
			locale === "en" ? "Plan your day with Aido" : "오늘 할 일을 정리해봐",
		body:
			locale === "en"
				? "Open Aido and start with one task"
				: "작은 일 하나부터 시작하면 돼",
	};
	return {
		...message,
		variantId: `${variantId}.v${index + 1}`,
	};
}
