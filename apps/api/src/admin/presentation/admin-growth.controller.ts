import { ErrorCode } from "@aido/errors";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
	Admin,
	CurrentUser,
	type CurrentUserPayload,
} from "@/auth/presentation/decorators";
import {
	ApiBadRequestError,
	ApiDoc,
	ApiForbiddenError,
	ApiSuccessResponse,
	SWAGGER_TAGS,
} from "@/shared/presentation/swagger";
import { AdminFacade } from "../application/facades/admin.facade";
import { GrowthSummaryQueryDto, GrowthSummaryResponseDto } from "./dtos";

@ApiTags(SWAGGER_TAGS.ADMIN_GROWTH)
@ApiBearerAuth()
@Controller("admin/growth")
export class AdminGrowthController {
	constructor(private readonly adminFacade: AdminFacade) {}

	@Get("summary")
	@Admin()
	@ApiDoc({
		summary: "성장 및 리텐션 지표 요약",
		operationId: "getAdminGrowthSummary",
		description:
			"가입 cohort 범위의 활성화·D1/D7/D30 리텐션과 종료 현지 날짜 기준 DAU/WAU/MAU를 집계합니다.",
	})
	@ApiSuccessResponse({ type: GrowthSummaryResponseDto })
	@ApiBadRequestError(ErrorCode.SYS_0002)
	@ApiForbiddenError(ErrorCode.ADMIN_1401)
	async getGrowthSummary(
		@CurrentUser() _user: CurrentUserPayload,
		@Query() query: GrowthSummaryQueryDto,
	): Promise<GrowthSummaryResponseDto> {
		return this.adminFacade.getGrowthSummary(query);
	}
}
