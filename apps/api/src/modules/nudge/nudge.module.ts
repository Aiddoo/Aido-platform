import { Module } from "@nestjs/common";

import { FollowModule } from "@/modules/follow/follow.module";

import { NudgeController } from "./nudge.controller";
import { NudgeRepository } from "./nudge.repository";
import { NudgeService } from "./nudge.service";

/**
 * Nudge 모듈
 *
 * 콕 찌르기(독촉) 기능을 담당합니다.
 * - 친구의 할 일에 대한 독촉 보내기
 * - 받은/보낸 독촉 목록 조회
 * - 일일 제한 및 쿨다운 관리
 *
 * 제한 정책:
 * - FREE 구독: 하루 10회
 * - ACTIVE 구독: 무제한
 * - 동일 Todo에 대해 24시간 쿨다운
 *
 * Event-driven:
 * - 독촉 전송 시 NotificationModule로 이벤트 발행
 * - NotificationModule의 NudgeListener가 푸시 알림 처리
 */
@Module({
	imports: [FollowModule],
	controllers: [NudgeController],
	providers: [NudgeRepository, NudgeService],
	exports: [NudgeService],
})
export class NudgeModule {}
