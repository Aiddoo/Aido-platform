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
  readonly idempotencyKey: string | null;
  readonly requestHash: string | null;
}

/** 앱이 저장 한 번마다 만든 키와 그 요청의 해시. 응답을 받지 못해 다시 보낸 저장을 알아본다 */
export interface MemoCreationRequest {
  readonly idempotencyKey: string;
  readonly requestHash: string;
}

interface MemoProps {
  readonly userId: UserId;
  content: MemoContent;
  isPinned: boolean;
  sortOrder: number;
  readonly createdAt: Temporal.Instant;
  updatedAt: Temporal.Instant;
  readonly idempotencyKey: string | null;
  readonly requestHash: string | null;
}

interface CreateMemoParams {
  readonly id: MemoId;
  readonly userId: UserId;
  readonly content: MemoContent;
  readonly sortOrder: number;
  readonly now: Temporal.Instant;
  /** 키 없이 만든 저장(출시 앱·음성 계획)은 null이다 */
  readonly creationRequest: MemoCreationRequest | null;
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
      idempotencyKey: params.creationRequest?.idempotencyKey ?? null,
      requestHash: params.creationRequest?.requestHash ?? null,
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
      idempotencyKey: primitives.idempotencyKey,
      requestHash: primitives.requestHash,
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

  /** 같은 Idempotency-Key로 다시 보낸 저장이 처음과 같은 내용인지 */
  isSameCreationRequest(requestHash: string): boolean {
    return this.props.requestHash === requestHash;
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
      idempotencyKey: this.props.idempotencyKey,
      requestHash: this.props.requestHash,
    };
  }
}
