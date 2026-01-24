/**
 * Cheer Mapper
 *
 * Prisma 엔티티를 DTO 형식으로 변환
 */

import type { Cheer, CheerDetail, CheerLimitInfo } from "@aido/validators";
import type {
	CheerWithRelations,
	CheerLimitInfo as ServiceLimitInfo,
} from "./types";

export class CheerMapper {
	/**
	 * CheerWithRelations → CheerDetail DTO 형식
	 */
	static toDetailDto(cheer: CheerWithRelations): CheerDetail {
		return {
			id: cheer.id,
			senderId: cheer.senderId,
			receiverId: cheer.receiverId,
			message: cheer.message,
			createdAt: cheer.createdAt,
			readAt: cheer.readAt ?? null,
			sender: {
				id: cheer.sender.id,
				userTag: cheer.sender.userTag,
				name: cheer.sender.profile?.name ?? null,
				profileImage: cheer.sender.profile?.profileImage ?? null,
			},
		};
	}

	/**
	 * CheerWithRelations → 기본 Cheer DTO 형식
	 */
	static toDto(cheer: CheerWithRelations): Cheer {
		return {
			id: cheer.id,
			senderId: cheer.senderId,
			receiverId: cheer.receiverId,
			message: cheer.message,
			createdAt: cheer.createdAt,
			readAt: cheer.readAt ?? null,
		};
	}

	/**
	 * CheerWithRelations 배열 → CheerDetail 배열
	 */
	static toDetailDtoList(cheers: CheerWithRelations[]): CheerDetail[] {
		return cheers.map((cheer) => this.toDetailDto(cheer));
	}

	/**
	 * Service LimitInfo → DTO LimitInfo
	 */
	static toLimitInfoDto(limitInfo: ServiceLimitInfo): CheerLimitInfo {
		return {
			dailyLimit: limitInfo.dailyLimit,
			usedToday: limitInfo.used,
			remainingToday: limitInfo.remaining,
			isUnlimited: limitInfo.dailyLimit === null,
		};
	}
}
