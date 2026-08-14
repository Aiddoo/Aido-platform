/**
 * Cheer 프레젠테이션 매퍼 — 애플리케이션 타입 → API 응답(@aido/validators). 계약 불변.
 */
import type { Cheer, CheerDetail, CheerLimitInfo } from "@aido/validators";

import { toISOString, toISOStringOrNull } from "@/shared/domain/date/utils/format";

import type { CheerWithRelations } from "../application/ports/cheer.repository.port";
import type { CheerLimitInfo as ReaderLimitInfo } from "../application/services/cheer.reader";

export abstract class CheerMapper {
	static toDetailDto(cheer: CheerWithRelations): CheerDetail {
		return {
			id: cheer.id,
			senderId: cheer.senderId,
			receiverId: cheer.receiverId,
			message: cheer.message,
			createdAt: toISOString(cheer.createdAt),
			readAt: toISOStringOrNull(cheer.readAt ?? null),
			sender: {
				id: cheer.sender.id,
				userTag: cheer.sender.userTag,
				name: cheer.sender.profile?.name ?? null,
				profileImage: cheer.sender.profile?.profileImage ?? null,
			},
		};
	}

	static toDto(cheer: CheerWithRelations): Cheer {
		return {
			id: cheer.id,
			senderId: cheer.senderId,
			receiverId: cheer.receiverId,
			message: cheer.message,
			createdAt: toISOString(cheer.createdAt),
			readAt: toISOStringOrNull(cheer.readAt ?? null),
		};
	}

	static toDetailDtoList(cheers: CheerWithRelations[]): CheerDetail[] {
		return cheers.map((cheer) => CheerMapper.toDetailDto(cheer));
	}

	static toLimitInfoDto(limitInfo: ReaderLimitInfo): CheerLimitInfo {
		return {
			dailyLimit: limitInfo.dailyLimit,
			usedToday: limitInfo.used,
			remainingToday: limitInfo.remaining,
			isUnlimited: limitInfo.dailyLimit === null,
		};
	}
}
