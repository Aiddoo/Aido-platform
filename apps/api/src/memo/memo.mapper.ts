import type { Memo as MemoResponse } from "@aido/validators";
import type { Memo } from "@/generated/prisma/client";
import { toISOString } from "@/shared/domain/date/utils/format";

export abstract class MemoMapper {
	static toResponse(entity: Memo): MemoResponse {
		return {
			id: entity.id,
			userId: entity.userId,
			content: entity.content,
			isPinned: entity.isPinned,
			sortOrder: entity.sortOrder,
			createdAt: toISOString(entity.createdAt),
			updatedAt: toISOString(entity.updatedAt),
		};
	}

	static toManyResponse(entities: Memo[]): MemoResponse[] {
		return entities.map((e) => MemoMapper.toResponse(e));
	}
}
