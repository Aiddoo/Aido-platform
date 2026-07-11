/**
 * Nudge 프레젠테이션 매퍼 — 애플리케이션 타입 → API 응답(@aido/validators). 계약 불변.
 */
import type {
	Nudge,
	NudgeDetail,
	NudgeLimitInfo,
	RemindNudge,
} from "@aido/validators";

import {
	toISOString,
	toISOStringOrNull,
} from "@/shared/domain/date/utils/format";

import type {
	NudgeWithRelations,
	ReminderNudgeWithRelations,
} from "../application/ports/nudge.repository.port";
import type { NudgeLimitInfo as ReaderLimitInfo } from "../application/services/nudge.reader";

export abstract class NudgeMapper {
	static toDetailDto(nudge: NudgeWithRelations): NudgeDetail {
		return {
			id: nudge.id,
			senderId: nudge.senderId,
			receiverId: nudge.receiverId,
			todoId: nudge.todoId,
			message: nudge.message,
			createdAt: toISOString(nudge.createdAt),
			readAt: toISOStringOrNull(nudge.readAt ?? null),
			sender: {
				id: nudge.sender.id,
				userTag: nudge.sender.userTag,
				name: nudge.sender.profile?.name ?? null,
				profileImage: nudge.sender.profile?.profileImage ?? null,
			},
			todo: {
				id: nudge.todo.id,
				title: nudge.todo.title,
				completed: nudge.todo.completed,
			},
		};
	}

	static toDto(nudge: NudgeWithRelations): Nudge {
		return {
			id: nudge.id,
			senderId: nudge.senderId,
			receiverId: nudge.receiverId,
			todoId: nudge.todoId,
			message: nudge.message,
			createdAt: toISOString(nudge.createdAt),
			readAt: toISOStringOrNull(nudge.readAt ?? null),
		};
	}

	static toDetailDtoList(nudges: NudgeWithRelations[]): NudgeDetail[] {
		return nudges.map((nudge) => NudgeMapper.toDetailDto(nudge));
	}

	static toRemindNudgeDto(nudge: ReminderNudgeWithRelations): RemindNudge {
		return {
			id: nudge.id,
			senderId: nudge.senderId,
			receiverId: nudge.receiverId,
			message: nudge.message,
			createdAt: toISOString(nudge.createdAt),
		};
	}

	static toLimitInfoDto(limitInfo: ReaderLimitInfo): NudgeLimitInfo {
		return {
			dailyLimit: limitInfo.dailyLimit,
			usedToday: limitInfo.used,
			remainingToday: limitInfo.remaining,
			isUnlimited: limitInfo.dailyLimit === null,
		};
	}
}
