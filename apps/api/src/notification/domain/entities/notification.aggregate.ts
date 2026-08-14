import { ErrorCode } from "@aido/errors";
import { AggregateRoot } from "@/shared/domain";
import { DomainException } from "@/shared/domain/exceptions/domain.exception";
import type { NotificationRecord } from "../records/notification.record";

/**
 * 알림 애그리게잇.
 *
 * 읽음 처리 시 소유권 불변식(타 사용자 알림 접근 금지 → NOTIFICATION_1005)과
 * 멱등성(이미 읽은 알림은 무동작)을 소유한다.
 */
interface NotificationProps {
	id: number;
	userId: string;
	isRead: boolean;
}

export class Notification extends AggregateRoot<NotificationProps> {
	static reconstitute(
		record: Pick<NotificationRecord, "id" | "userId" | "isRead">,
	): Notification {
		return new Notification({ ...record });
	}

	get id(): number {
		return this.props.id;
	}

	/**
	 * 읽음 처리 계획.
	 *
	 * @returns 저장소 갱신이 필요하면 true, 이미 읽은 상태면 false
	 * @throws {DomainException} NOTIFICATION_1005 — 다른 사용자의 알림
	 */
	planMarkRead(requesterId: string): boolean {
		if (this.props.userId !== requesterId) {
			throw new DomainException(ErrorCode.NOTIFICATION_1005, {
				notificationId: this.props.id,
			});
		}
		if (this.props.isRead) return false;
		this.props.isRead = true;
		return true;
	}
}
