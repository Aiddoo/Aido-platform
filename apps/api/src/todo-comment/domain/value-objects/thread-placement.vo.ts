import { ErrorCode } from "@aido/errors";

import { DomainException, ValueObject } from "@/shared/domain";

import { TodoCommentId } from "./todo-comment-id.vo";

interface ThreadPlacementProps {
	/** 직계 부모. 최상위 댓글이면 null */
	parentId: TodoCommentId | null;
	/** 대화의 뿌리. 최상위 댓글이면 null */
	rootId: TodoCommentId | null;
	/** 뿌리 → 부모 순서의 조상 id */
	path: readonly string[];
}

/**
 * 스레드에서 댓글이 놓인 자리.
 *
 * 최상위 댓글은 부모도 뿌리도 조상도 없고, 답글은 셋 다 가진다.
 * 이 짝이 어긋나면 대화가 어디에 속하는지 알 수 없으므로 생성 시점에 막는다.
 */
export class ThreadPlacement extends ValueObject<ThreadPlacementProps> {
	/** 할 일에 바로 달린 댓글의 자리. */
	static topLevel(): ThreadPlacement {
		return new ThreadPlacement({ parentId: null, rootId: null, path: [] });
	}

	/** 영속된 자리를 복원한다 — 저장된 값은 이미 유효하므로 짝만 확인한다. */
	static reconstitute(props: {
		parentId: string | null;
		rootId: string | null;
		path: readonly string[];
	}): ThreadPlacement {
		if (props.parentId === null) {
			if (props.rootId !== null || props.path.length > 0) {
				throw new DomainException(ErrorCode.SYS_0002, {
					reason: "topLevelPlacementMustNotHaveAncestors",
				});
			}

			return ThreadPlacement.topLevel();
		}

		if (props.rootId === null || props.path.at(-1) !== props.parentId) {
			throw new DomainException(ErrorCode.SYS_0002, {
				reason: "replyPlacementMustEndWithParent",
			});
		}

		return new ThreadPlacement({
			parentId: TodoCommentId.create(props.parentId),
			rootId: TodoCommentId.create(props.rootId),
			path: [...props.path],
		});
	}

	/**
	 * 이 자리에 놓인 댓글 아래로 들어갈 답글의 자리.
	 * 답글의 뿌리는 내 뿌리이고, 내가 뿌리가 없으면(=내가 최상위면) 내가 뿌리가 된다.
	 */
	under(parentId: TodoCommentId): ThreadPlacement {
		return new ThreadPlacement({
			parentId,
			rootId: this.value.rootId ?? parentId,
			path: [...this.value.path, parentId.getValue()],
		});
	}

	get parentId(): TodoCommentId | null {
		return this.value.parentId;
	}

	get rootId(): TodoCommentId | null {
		return this.value.rootId;
	}

	get path(): readonly string[] {
		return [...this.value.path];
	}

	/** 뿌리에서 이 댓글까지의 깊이. 최상위는 0이다. */
	get depth(): number {
		return this.value.path.length;
	}

	get isTopLevel(): boolean {
		return this.value.parentId === null;
	}
}
