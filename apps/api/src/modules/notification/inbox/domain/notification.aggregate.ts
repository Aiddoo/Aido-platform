import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { NotificationId } from "./notification-id.vo.js";
import type { NotificationType } from "./notification-type.constants.js";

export interface NotificationPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly copyKey: string | null;
  readonly copyFacts: Readonly<Record<string, unknown>> | null;
  readonly isRead: boolean;
  readonly readAt: Temporal.Instant | null;
  readonly openedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
}

interface NotificationProps {
  readonly userId: UserId;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly copyKey: string | null;
  readonly copyFacts: Readonly<Record<string, unknown>> | null;
  isRead: boolean;
  readAt: Temporal.Instant | null;
  readonly openedAt: Temporal.Instant | null;
  readonly createdAt: Temporal.Instant;
}

export class Notification extends AggregateRoot<NotificationId, NotificationProps> {
  static reconstitute(primitives: NotificationPrimitives): Notification {
    return new Notification(NotificationId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      type: primitives.type,
      title: primitives.title,
      body: primitives.body,
      copyKey: primitives.copyKey,
      copyFacts: primitives.copyFacts,
      isRead: primitives.isRead,
      readAt: primitives.readAt,
      openedAt: primitives.openedAt,
      createdAt: primitives.createdAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get isRead(): boolean {
    return this.props.isRead;
  }

  get readAt(): Temporal.Instant | null {
    return this.props.readAt;
  }

  // 이미 읽은 알림이어도 남의 알림이면 소유권 오류가 먼저다
  markRead(requesterId: UserId, now: Temporal.Instant): boolean {
    if (!this.props.userId.equals(requesterId)) {
      throw new DomainException(ErrorCode.NOTIFICATION_1005, { notificationId: this.id.value });
    }
    if (this.props.isRead) {
      return false;
    }
    this.props.isRead = true;
    this.props.readAt = now;
    return true;
  }

  toPrimitives(): NotificationPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      type: this.props.type,
      title: this.props.title,
      body: this.props.body,
      copyKey: this.props.copyKey,
      copyFacts: this.props.copyFacts,
      isRead: this.props.isRead,
      readAt: this.props.readAt,
      openedAt: this.props.openedAt,
      createdAt: this.props.createdAt,
    };
  }
}
