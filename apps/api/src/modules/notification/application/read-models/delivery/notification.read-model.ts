import type { NotificationType } from "../../../domain/types/delivery/notification-type.js";

/**
 * 알림 읽기 레코드 (조회 projection).
 *
 * Prisma `Notification` 행이 구조적으로 이 인터페이스를 만족한다
 * (metadata는 불투명 `unknown`, 날짜는 `Date`). 어댑터는 Prisma 행을 그대로
 * 반환하고, 애플리케이션/도메인은 `@/generated` 결합 없이 이 레코드로 다룬다.
 */
export interface NotificationRecord {
  readonly id: number;
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly isRead: boolean;
  readonly todoId: number | null;
  readonly friendId: string | null;
  readonly nudgeId: number | null;
  readonly cheerId: number | null;
  readonly notificationDate: Date | null;
  readonly metadata: unknown;
  readonly createdAt: Date;
  readonly readAt: Date | null;
  readonly actionType: "DEEP_LINK" | "BROWSER" | "WEBVIEW" | "NONE";
  readonly actionUrl: string | null;
  readonly campaignKey: string | null;
  readonly variantId: string | null;
  readonly purpose: "TRANSACTIONAL" | "SCHEDULED_SERVICE" | "ENGAGEMENT";
  readonly openedAt: Date | null;
}
