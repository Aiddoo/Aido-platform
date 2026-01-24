/**
 * Nudge Mapper
 *
 * Prisma 엔티티를 DTO 형식으로 변환
 */

import type { Nudge, NudgeDetail, NudgeLimitInfo } from "@aido/validators";
import type {
	NudgeWithRelations,
	NudgeLimitInfo as ServiceLimitInfo,
} from "./types";

export class NudgeMapper {
	/**
	 * NudgeWithRelations → NudgeDetail DTO 형식
	 */
	static toDetailDto(nudge: NudgeWithRelations): NudgeDetail {
		return {
			id: nudge.id,
			senderId: nudge.senderId,
			receiverId: nudge.receiverId,
			todoId: nudge.todoId,
			message: nudge.message,
			createdAt: nudge.createdAt,
			readAt: nudge.readAt ?? null,
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

	/**
	 * NudgeWithRelations → 기본 Nudge DTO 형식
	 */
	static toDto(nudge: NudgeWithRelations): Nudge {
		return {
			id: nudge.id,
			senderId: nudge.senderId,
			receiverId: nudge.receiverId,
			todoId: nudge.todoId,
			message: nudge.message,
			createdAt: nudge.createdAt,
			readAt: nudge.readAt ?? null,
		};
	}

	/**
	 * NudgeWithRelations 배열 → NudgeDetail 배열
	 */
	static toDetailDtoList(nudges: NudgeWithRelations[]): NudgeDetail[] {
		return nudges.map((nudge) => this.toDetailDto(nudge));
	}

	/**
	 * Service LimitInfo → DTO LimitInfo
	 */
	static toLimitInfoDto(limitInfo: ServiceLimitInfo): NudgeLimitInfo {
		return {
			dailyLimit: limitInfo.dailyLimit,
			usedToday: limitInfo.used,
			remainingToday: limitInfo.remaining,
			isUnlimited: limitInfo.dailyLimit === null,
		};
	}
}
