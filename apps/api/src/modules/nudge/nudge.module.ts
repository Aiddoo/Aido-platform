import { Module } from "@nestjs/common";

import { FollowModule } from "@/modules/follow/follow.module";
import { NotificationModule } from "@/modules/notification/notification.module";

import { NudgeController } from "./nudge.controller";
import { NudgeRepository } from "./nudge.repository";
import { NudgeService } from "./nudge.service";

/**
 * Nudge 모듈
 *
 * 콕 찌르기 기능을 담당합니다.
 * - 친구의 할 일에 대한 콕 찌르기 보내기
 * - 받은/보낸 콕 찌르기 목록 조회
 * - 일일 제한 및 쿨다운 관리
 *
 * 제한 정책:
 * - FREE 구독: 하루 3회
 * - ACTIVE 구독: 무제한
 * - 동일 Todo에 대해 24시간 쿨다운
 *
 * BullMQ 큐 기반 알림:
 * - 콕 찌르기 전송 시 NotificationQueueService로 알림 잡 등록
 * - NotificationQueueProcessor가 푸시 알림 처리
 */
@Module({
	imports: [FollowModule, NotificationModule],
	controllers: [NudgeController],
	providers: [NudgeRepository, NudgeService],
	exports: [NudgeService],
})
export class NudgeModule {}
