import { Module } from "@nestjs/common";

import { InviteController } from "./invite.controller";
import { InviteService } from "./invite.service";
import { InviteTemplateService } from "./invite.template";

/**
 * Invite 모듈
 *
 * 친구 초대 링크 랜딩페이지를 제공합니다.
 * - GET /invite/:userTag — 초대 HTML 페이지 (Public, 카카오톡 OG 미리보기 지원)
 */
@Module({
	controllers: [InviteController],
	providers: [InviteService, InviteTemplateService],
})
export class InviteModule {}
