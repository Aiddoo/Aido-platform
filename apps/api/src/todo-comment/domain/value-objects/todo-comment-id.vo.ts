import { EntityId } from "@/shared/domain";

export class TodoCommentId extends EntityId<string> {
	static create(value: string): TodoCommentId {
		return new TodoCommentId(value);
	}
}
