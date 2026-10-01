import { EntityId } from "#api/shared/domain/index";

export class TodoCommentId extends EntityId<string> {
	static create(value: string): TodoCommentId {
		return new TodoCommentId(value);
	}
}
