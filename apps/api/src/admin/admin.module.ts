import { Module } from "@nestjs/common";

import { NotificationModule } from "#api/notification/index";

import { ADMIN_PROVIDERS } from "./application/admin.providers.js";
import { ADMIN_BROADCAST_NOTIFIER } from "./application/ports/admin-broadcast-notifier.port.js";
import { ADMIN_GROWTH_METRICS } from "./application/ports/admin-growth-metrics.port.js";
import { ADMIN_USER_DIRECTORY } from "./application/ports/admin-user-directory.port.js";
import { NotificationAdminBroadcastNotifierAdapter } from "./infrastructure/adapters/notification-admin-broadcast-notifier.adapter.js";
import { PrismaAdminGrowthMetricsAdapter } from "./infrastructure/adapters/prisma-admin-growth-metrics.adapter.js";
import { PrismaAdminUserDirectoryAdapter } from "./infrastructure/adapters/prisma-admin-user-directory.adapter.js";
import { AdminGrowthController } from "./presentation/admin-growth.controller.js";
import { AdminController } from "./presentation/admin.controller.js";

/**
 * 관리자 모듈 (클린아키텍처)
 *
 * 관리자 전용 알림 발송(브로드캐스트/타겟). 대상 조회와 발송을 각각 포트로
 * 추상화하며, 현재 어댑터는 Prisma·NotificationService다.
 */
@Module({
	imports: [NotificationModule],
	controllers: [AdminController, AdminGrowthController],
	providers: [
		{
			provide: ADMIN_USER_DIRECTORY,
			useClass: PrismaAdminUserDirectoryAdapter,
		},
		{
			provide: ADMIN_BROADCAST_NOTIFIER,
			useClass: NotificationAdminBroadcastNotifierAdapter,
		},
		{
			provide: ADMIN_GROWTH_METRICS,
			useClass: PrismaAdminGrowthMetricsAdapter,
		},
		...ADMIN_PROVIDERS,
	],
})
export class AdminModule {}
