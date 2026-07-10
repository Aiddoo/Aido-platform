import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { NotificationModule } from "@/notification/notification.module";
import { AdminFacade } from "./application/facades/admin.facade";
import { ADMIN_BROADCAST_NOTIFIER } from "./application/ports/admin-broadcast-notifier.port";
import { ADMIN_USER_DIRECTORY } from "./application/ports/admin-user-directory.port";
import { CommandHandlers } from "./application/use-cases";
import { NotificationAdminBroadcastNotifierAdapter } from "./infrastructure/adapters/notification-admin-broadcast-notifier.adapter";
import { PrismaAdminUserDirectoryAdapter } from "./infrastructure/adapters/prisma-admin-user-directory.adapter";
import { AdminController } from "./presentation/admin.controller";

/**
 * 관리자 모듈 (클린아키텍처)
 *
 * 관리자 전용 알림 발송(브로드캐스트/타겟). 대상 조회와 발송을 각각 포트로
 * 추상화하며, 현재 어댑터는 Prisma·NotificationService다.
 */
@Module({
	imports: [CqrsModule, NotificationModule],
	controllers: [AdminController],
	providers: [
		AdminFacade,
		{
			provide: ADMIN_USER_DIRECTORY,
			useClass: PrismaAdminUserDirectoryAdapter,
		},
		{
			provide: ADMIN_BROADCAST_NOTIFIER,
			useClass: NotificationAdminBroadcastNotifierAdapter,
		},
		...CommandHandlers,
	],
})
export class AdminModule {}
