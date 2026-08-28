import { Module } from "@nestjs/common";

import { FollowModule } from "@/follow/follow.module";
import { NotificationModule } from "@/notification";

import { NUDGE_LIMIT_READER } from "./application/ports/nudge-limit-reader.port";
import { NUDGE_NOTIFIER } from "./application/ports/nudge-notifier.port";
import { NUDGE_REPOSITORY } from "./application/ports/nudge.repository.port";
import { NudgeReader } from "./application/services/nudge.reader";
import { MarkNudgeReadUseCase } from "./application/use-cases/mark-nudge-read/mark-nudge-read.use-case";
import { SendNudgeUseCase } from "./application/use-cases/send-nudge/send-nudge.use-case";
import { SendRemindNudgeUseCase } from "./application/use-cases/send-remind-nudge/send-remind-nudge.use-case";
import { NudgeLimitReaderAdapter } from "./infrastructure/adapters/nudge-limit-reader.adapter";
import { NudgeNotifierAdapter } from "./infrastructure/adapters/nudge-notifier.adapter";
import { PrismaNudgeRepository } from "./infrastructure/persistence/prisma-nudge.repository";
import { NudgeController } from "./presentation/nudge.controller";

/**
 * Nudge 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 친구의 할 일을 콕 찌르거나(sendNudge), 오늘 할 일이 없는 친구를 독촉한다(sendRemindNudge).
 * 컨트롤러는 endpoint별 UseCase와 Reader를 직접 주입한다.
 *
 * 제한 정책:
 * - 콕 찌르기: FREE 하루 3회 / ACTIVE 무제한, 동일 Todo 24시간 쿨다운, 오늘의 공개 할 일만 대상
 * - 리마인드 콕 찌르기: 일일 제한 없음, 동일 친구 1시간 쿨다운, 친구가 오늘 할 일이 없을 때만
 *
 * BullMQ 큐 기반 알림: 전송 시 NUDGE_NOTIFIER(NotificationQueueService 위임)로 알림 잡을 등록한다.
 */
@Module({
	imports: [FollowModule, NotificationModule],
	controllers: [NudgeController],
	providers: [
		{ provide: NUDGE_REPOSITORY, useClass: PrismaNudgeRepository },
		{ provide: NUDGE_NOTIFIER, useClass: NudgeNotifierAdapter },
		{ provide: NUDGE_LIMIT_READER, useClass: NudgeLimitReaderAdapter },
		NudgeReader,
		SendNudgeUseCase,
		SendRemindNudgeUseCase,
		MarkNudgeReadUseCase,
	],
})
export class NudgeModule {}
