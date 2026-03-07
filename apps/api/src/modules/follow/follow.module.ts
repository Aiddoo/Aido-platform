import { Module } from "@nestjs/common";

import { NotificationModule } from "@/modules/notification/notification.module";

import { FollowController } from "./follow.controller";
import { FollowRepository } from "./follow.repository";
import { FollowService } from "./follow.service";

/**
 * Follow 모듈
 *
 * 친구 요청 및 관계 관리 기능을 담당합니다.
 * - 친구 요청 보내기/수락/거절
 * - 친구 삭제
 * - 친구 목록 조회
 * - 받은/보낸 친구 요청 조회
 */
@Module({
	imports: [NotificationModule],
	controllers: [FollowController],
	providers: [FollowRepository, FollowService],
	exports: [FollowService],
})
export class FollowModule {}
