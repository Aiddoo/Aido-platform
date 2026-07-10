import { Injectable } from "@nestjs/common";
import { NotificationService } from "@/notification/notification.service";
import type {
	AdminBroadcastMessage,
	AdminBroadcastNotifierPort,
} from "../../application/ports/admin-broadcast-notifier.port";

/**
 * AdminBroadcastNotifierPort의 NotificationService 어댑터.
 *
 * 벤더 중립 브로드캐스트 메시지를 알림 모듈의 배치 생성·발송으로 위임한다.
 * 다른 발송 채널로 바꾸려면 이 어댑터만 교체하면 된다.
 */
@Injectable()
export class NotificationAdminBroadcastNotifierAdapter
	implements AdminBroadcastNotifierPort
{
	constructor(private readonly notificationService: NotificationService) {}

	sendBatch(messages: AdminBroadcastMessage[]): Promise<{ count: number }> {
		return this.notificationService.createAndSendBatch(
			messages.map((message) => ({
				userId: message.userId,
				type: message.type,
				title: message.title,
				body: message.body,
				action: message.action,
				metadata: message.metadata,
			})),
		);
	}
}
