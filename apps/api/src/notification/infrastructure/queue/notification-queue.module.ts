import { Module } from "@nestjs/common";

import { NotificationQueueService } from "./notification-queue.service";

/**
 * Notification Queue 모듈
 *
 * 알림 잡 enqueue capability와 런타임 연결만 포함합니다.
 * NotificationModule과 분리하여 순환 참조를 방지합니다.
 *
 * - AuthModule 등 알림 큐만 필요한 모듈은 이 모듈을 직접 import
 * - NotificationModule은 이 모듈을 import하여 Processor와 함께 구성
 */
@Module({
	providers: [NotificationQueueService],
	exports: [NotificationQueueService],
})
export class NotificationQueueModule {}
