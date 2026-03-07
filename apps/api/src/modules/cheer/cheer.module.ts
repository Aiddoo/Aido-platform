import { Module } from "@nestjs/common";

import { FollowModule } from "@/modules/follow/follow.module";
import { NotificationModule } from "@/modules/notification/notification.module";

import { CheerController } from "./cheer.controller";
import { CheerRepository } from "./cheer.repository";
import { CheerService } from "./cheer.service";

/**
 * Cheer 모듈
 *
 * 응원하기 기능을 담당합니다.
 * - 친구에게 응원 메시지 보내기
 * - 받은/보낸 응원 목록 조회
 * - 일일 제한 및 쿨다운 관리
 *
 * 제한 정책:
 * - FREE 구독: 하루 3회
 * - ACTIVE 구독: 무제한
 * - 동일 친구에게 24시간 쿨다운
 *
 * 콕 찌르기(Nudge)와의 차이:
 * - Nudge: 특정 할 일에 대한 콕 찌르기 (todoId 필요)
 * - Cheer: 친구 자체에 대한 응원 (메시지만)
 *
 * BullMQ 큐 기반 알림:
 * - 응원 전송 시 NotificationQueueService로 알림 잡 등록
 * - NotificationQueueProcessor가 푸시 알림 처리
 */
@Module({
	imports: [FollowModule, NotificationModule],
	controllers: [CheerController],
	providers: [CheerRepository, CheerService],
	exports: [CheerService],
})
export class CheerModule {}
