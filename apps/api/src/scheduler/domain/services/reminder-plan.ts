/**
 * 투두 리마인더 다단계 스케줄 정책 (순수 도메인).
 *
 * 마감 시각(scheduledTime) 기준으로 어떤 단계의 지연 잡을 언제 예약할지 계획한다.
 * 실제 큐 등록(BullMQ)은 인프라 어댑터가 이 계획을 실행만 한다.
 */

export interface ReminderStage {
	readonly leadTimeMs: number;
	readonly label: string;
}

/** 리마인더 단계 (큰 leadTime부터 정렬) */
export const REMINDER_STAGES: readonly ReminderStage[] = [
	{ leadTimeMs: 60 * 60 * 1000, label: "60min" },
	{ leadTimeMs: 10 * 60 * 1000, label: "10min" },
] as const;

/** 최대 리드 타임 (복구/크론 범위 계산용) */
export const REMINDER_MAX_LEAD_TIME_MS =
	REMINDER_STAGES[0]?.leadTimeMs ?? 60 * 60 * 1000;

/** 즉시 발송 label */
export const REMINDER_IMMEDIATE_LABEL = "immediate";

/** 하위 호환: 기존 임포트 유지 */
export const REMINDER_LEAD_TIME_MS = REMINDER_MAX_LEAD_TIME_MS;

/** 예약할 단일 리마인더 잡 (label + 지연 ms) */
export interface PlannedReminderJob {
	readonly label: string;
	readonly delay: number;
}

/**
 * 마감 시각과 현재 시각으로 예약할 리마인더 잡 목록을 계획한다.
 *
 * - scheduledTime이 이미 과거면 아무 잡도 계획하지 않는다(빈 배열).
 * - 각 단계 중 리드 타임을 빼도 여전히 미래인 단계만 지연 잡으로 계획한다.
 * - 모든 단계가 이미 지났지만 scheduledTime은 미래라면 즉시 발송 잡 1건을 계획한다.
 */
export function planReminderJobs(
	scheduledMs: number,
	nowMs: number,
): PlannedReminderJob[] {
	if (scheduledMs <= nowMs) {
		return [];
	}

	const jobs: PlannedReminderJob[] = [];
	for (const stage of REMINDER_STAGES) {
		const delay = scheduledMs - stage.leadTimeMs - nowMs;
		if (delay > 0) {
			jobs.push({ label: stage.label, delay });
		}
	}

	if (jobs.length === 0) {
		jobs.push({ label: REMINDER_IMMEDIATE_LABEL, delay: 0 });
	}

	return jobs;
}

/** 특정 todoId의 모든 단계 잡 라벨(취소 시 순회용) */
export function allReminderLabels(): string[] {
	return [...REMINDER_STAGES.map((s) => s.label), REMINDER_IMMEDIATE_LABEL];
}
