import { Module } from "@nestjs/common";

import { FollowModule } from "@/follow/follow.module";
import { NotificationModule } from "@/notification/notification.module";

import { CHEER_REPOSITORY } from "./application/ports/cheer.repository.port";
import { CHEER_LIMIT_READER } from "./application/ports/cheer-limit-reader.port";
import { CHEER_NOTIFIER } from "./application/ports/cheer-notifier.port";
import { CheerReader } from "./application/services/cheer.reader";
import { MarkCheerReadUseCase } from "./application/use-cases/mark-cheer-read/mark-cheer-read.use-case";
import { MarkManyCheersReadUseCase } from "./application/use-cases/mark-many-cheers-read/mark-many-cheers-read.use-case";
import { SendCheerUseCase } from "./application/use-cases/send-cheer/send-cheer.use-case";
import { CheerLimitReaderAdapter } from "./infrastructure/adapters/cheer-limit-reader.adapter";
import { CheerNotifierAdapter } from "./infrastructure/adapters/cheer-notifier.adapter";
import { PrismaCheerRepository } from "./infrastructure/persistence/prisma-cheer.repository";
import { CheerController } from "./presentation/cheer.controller";

/**
 * Cheer 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 친구에게 응원 메시지를 보내고 조회한다. 컨트롤러는 endpoint별 UseCase와 Reader를 직접 주입한다.
 * 제한 정책: FREE 하루 3회 / ACTIVE 무제한, 동일 친구 24시간 쿨다운.
 */
@Module({
	imports: [FollowModule, NotificationModule],
	controllers: [CheerController],
	providers: [
		{ provide: CHEER_REPOSITORY, useClass: PrismaCheerRepository },
		{ provide: CHEER_NOTIFIER, useClass: CheerNotifierAdapter },
		{ provide: CHEER_LIMIT_READER, useClass: CheerLimitReaderAdapter },
		CheerReader,
		SendCheerUseCase,
		MarkCheerReadUseCase,
		MarkManyCheersReadUseCase,
	],
})
export class CheerModule {}
