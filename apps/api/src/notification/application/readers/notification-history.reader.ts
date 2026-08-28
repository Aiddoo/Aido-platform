import type { NotificationType } from "../../domain/types/notification-type";
import type { FindAlreadyNotifiedUsersUseCase } from "../use-cases/find-already-notified-users/find-already-notified-users.use-case";

export interface FindAlreadyNotifiedRecipientsQuery {
	readonly userIds: string[];
	readonly type: NotificationType;
	readonly notificationDate: Date;
	readonly friendId?: string;
}

/** 캐시·DB fallback 세부사항을 숨기는 알림 발송 이력 조회 capability. */
export class NotificationHistoryReader {
	constructor(private readonly findAlreadyNotifiedUsers: FindAlreadyNotifiedUsersUseCase) {}

	findAlreadyNotifiedUserIds(query: FindAlreadyNotifiedRecipientsQuery): Promise<Set<string>> {
		return this.findAlreadyNotifiedUsers.execute(query);
	}
}
