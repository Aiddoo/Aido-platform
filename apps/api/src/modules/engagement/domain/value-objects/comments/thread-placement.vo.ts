import { ErrorCode } from "@aido/api/errors";

import { DomainException, ValueObject } from "#api/shared/domain/index";

import { TodoCommentId } from "./todo-comment-id.vo.js";

interface ThreadPlacementProps {
  parentId: TodoCommentId | null;
  rootId: TodoCommentId | null;
  path: readonly string[];
}

export class ThreadPlacement extends ValueObject<ThreadPlacementProps> {
  static topLevel(): ThreadPlacement {
    return new ThreadPlacement({ parentId: null, rootId: null, path: [] });
  }

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

  get depth(): number {
    return this.value.path.length;
  }

  get isTopLevel(): boolean {
    return this.value.parentId === null;
  }
}
