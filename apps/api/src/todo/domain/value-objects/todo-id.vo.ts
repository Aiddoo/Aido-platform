import { ErrorCode } from "@aido/errors";

import { DomainException, EntityId } from "@/shared/domain";

/**
 * Todo 식별자 VO
 *
 * Prisma autoincrement 정수 PK를 감쌉니다. 양의 정수만 허용합니다.
 */
export class TodoId extends EntityId<number> {
	static create(value: number): TodoId {
		if (!Number.isInteger(value) || value <= 0) {
			throw new DomainException(ErrorCode.SYS_0002, { value }, "유효하지 않은 Todo ID입니다.");
		}
		return new TodoId(value);
	}
}
