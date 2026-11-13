import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { CheerId } from "./cheer-id.vo.js";
import { CheerMessage } from "./cheer-message.vo.js";
import { cannotCheerSelf } from "./cheers.errors.js";

export interface CheerPrimitives {
  readonly id: number;
  readonly senderId: string;
  readonly receiverId: string;
  readonly message: string | null;
  readonly readAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
}

interface CheerProps {
  readonly senderId: UserId;
  readonly receiverId: UserId;
  readonly message: CheerMessage | null;
  readAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
}

interface CreateCheerParams {
  readonly id: CheerId;
  readonly senderId: UserId;
  readonly receiverId: UserId;
  readonly message: CheerMessage | null;
  readonly now: Temporal.Instant;
}

export class Cheer extends AggregateRoot<CheerId, CheerProps> {
  static create(params: CreateCheerParams): Cheer {
    if (params.senderId.equals(params.receiverId)) {
      throw cannotCheerSelf();
    }
    return new Cheer(params.id, {
      senderId: params.senderId,
      receiverId: params.receiverId,
      message: params.message,
      readAt: null,
      createdAt: params.now,
    });
  }

  static reconstitute(primitives: CheerPrimitives): Cheer {
    return new Cheer(CheerId.reconstitute(primitives.id), {
      senderId: UserId.reconstitute(primitives.senderId),
      receiverId: UserId.reconstitute(primitives.receiverId),
      message: primitives.message == null ? null : CheerMessage.reconstitute(primitives.message),
      readAt: primitives.readAt,
      createdAt: primitives.createdAt,
    });
  }

  get senderId(): UserId {
    return this.props.senderId;
  }

  get receiverId(): UserId {
    return this.props.receiverId;
  }

  get message(): CheerMessage | null {
    return this.props.message;
  }

  get readAt(): Temporal.Instant | null {
    return this.props.readAt;
  }

  get createdAt(): Temporal.Instant {
    return this.props.createdAt;
  }

  isReceivedBy(userId: UserId): boolean {
    return this.props.receiverId.equals(userId);
  }

  markRead(now: Temporal.Instant): boolean {
    if (this.props.readAt != null) {
      return false;
    }
    this.props.readAt = now;
    return true;
  }

  toPrimitives(): CheerPrimitives {
    return {
      id: this.id.value,
      senderId: this.props.senderId.value,
      receiverId: this.props.receiverId.value,
      message: this.props.message?.value ?? null,
      readAt: this.props.readAt,
      createdAt: this.props.createdAt,
    };
  }
}
