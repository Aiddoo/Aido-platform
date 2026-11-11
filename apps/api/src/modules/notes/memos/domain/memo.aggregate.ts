import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { MemoContent } from "./memo-content.vo.js";
import { MemoId } from "./memo-id.vo.js";

export interface MemoPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly content: string;
  readonly isPinned: boolean;
  readonly sortOrder: number;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
}

interface MemoProps {
  readonly userId: UserId;
  content: MemoContent;
  isPinned: boolean;
  sortOrder: number;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
}

interface CreateMemoParams {
  readonly id: MemoId;
  readonly userId: UserId;
  readonly content: MemoContent;
  readonly sortOrder: number;
  readonly now: Temporal.Instant;
}

export class Memo extends AggregateRoot<MemoId, MemoProps> {
  static create(params: CreateMemoParams): Memo {
    return new Memo(params.id, {
      userId: params.userId,
      content: params.content,
      isPinned: false,
      sortOrder: params.sortOrder,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: MemoPrimitives): Memo {
    return new Memo(MemoId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      content: MemoContent.reconstitute(primitives.content),
      isPinned: primitives.isPinned,
      sortOrder: primitives.sortOrder,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get content(): MemoContent {
    return this.props.content;
  }

  get isPinned(): boolean {
    return this.props.isPinned;
  }

  get sortOrder(): number {
    return this.props.sortOrder;
  }

  rewrite(content: MemoContent, now: Temporal.Instant): boolean {
    if (this.props.content.equals(content)) {
      return false;
    }
    this.props.content = content;
    this.props.updatedAt = now;
    return true;
  }

  changePinned(isPinned: boolean, now: Temporal.Instant): boolean {
    if (this.props.isPinned === isPinned) {
      return false;
    }
    this.props.isPinned = isPinned;
    this.props.updatedAt = now;
    return true;
  }

  moveTo(sortOrder: number, now: Temporal.Instant): boolean {
    if (this.props.sortOrder === sortOrder) {
      return false;
    }
    this.props.sortOrder = sortOrder;
    this.props.updatedAt = now;
    return true;
  }

  toTodoTitle(): string {
    return this.props.content.toTodoTitle();
  }

  toPrimitives(): MemoPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      content: this.props.content.value,
      isPinned: this.props.isPinned,
      sortOrder: this.props.sortOrder,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
