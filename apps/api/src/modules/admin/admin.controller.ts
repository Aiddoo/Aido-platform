import { ErrorCode } from "@aido/errors";
import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import {
	ApiBadRequestError,
	ApiDoc,
	ApiForbiddenError,
	ApiSuccessResponse,
	SWAGGER_TAGS,
} from "@/common/swagger";

import {
	Admin,
	CurrentUser,
	type CurrentUserPayload,
} from "../auth/decorators";
import { AdminService } from "./admin.service";
import {
	BroadcastNotificationDto,
	BroadcastResultDto,
	TargetedNotificationDto,
} from "./dto";

@ApiTags(SWAGGER_TAGS.ADMIN_NOTIFICATIONS)
@Controller("admin/notifications")
export class AdminController {
	constructor(private readonly adminService: AdminService) {}

	@Post("broadcast")
	@Admin()
	@ApiDoc({
		summary: "전체/조건부 알림 발송",
		description: `지정된 대상 필터에 따라 여러 사용자에게 알림을 발송합니다.

**대상 필터 옵션**
- \`ALL\`: 모든 활성 사용자
- \`WITH_PUSH_TOKEN\`: 푸시 토큰이 등록된 사용자
- \`ACTIVE_LAST_7_DAYS\`: 최근 7일 내 활동한 사용자
- \`ACTIVE_LAST_30_DAYS\`: 최근 30일 내 활동한 사용자
- \`SUBSCRIBERS\`: 유료 구독 사용자`,
	})
	@ApiSuccessResponse({ type: BroadcastResultDto })
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiForbiddenError("관리자 권한이 필요합니다")
	async broadcastNotification(
		@CurrentUser() _user: CurrentUserPayload,
		@Body() dto: BroadcastNotificationDto,
	): Promise<BroadcastResultDto> {
		return this.adminService.broadcastNotification(dto);
	}

	@Post("targeted")
	@Admin()
	@ApiDoc({
		summary: "특정 사용자 알림 발송",
		description: `지정된 사용자 ID 목록에 해당하는 사용자들에게 알림을 발송합니다.

존재하지 않는 사용자 ID는 자동으로 필터링됩니다.`,
	})
	@ApiSuccessResponse({ type: BroadcastResultDto })
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiForbiddenError("관리자 권한이 필요합니다")
	async sendTargetedNotification(
		@CurrentUser() _user: CurrentUserPayload,
		@Body() dto: TargetedNotificationDto,
	): Promise<BroadcastResultDto> {
		return this.adminService.sendTargetedNotification(dto);
	}
}
