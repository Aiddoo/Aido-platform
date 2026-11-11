import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { Admin } from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiConflictError,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { CreateBroadcastCampaignUseCase } from "../../../application/use-cases/create-broadcast-campaign.use-case.js";
import { GetBroadcastCampaignUseCase } from "../../../application/use-cases/get-broadcast-campaign.use-case.js";
import { BroadcastCampaignId } from "../../../domain/broadcast-campaign-id.vo.js";
import {
  toBroadcastCampaignAcceptedDto,
  toBroadcastCampaignDto,
} from "./broadcast-campaign-response.mapper.js";
import {
  BroadcastCampaignAcceptedDto,
  BroadcastCampaignDto,
  BroadcastCampaignIdParamDto,
  CreateBroadcastCampaignDto,
} from "./broadcast-campaign.dto.js";

const THROTTLED_DESCRIPTION = "브로드캐스트 접수가 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
const BROADCAST_CREATION_THROTTLE = { ttl: 60_000, limit: 5 } as const;

@ApiTags(SWAGGER_TAGS.ADMIN_NOTIFICATIONS)
@ApiBearerAuth()
@Controller({ path: "admin/notifications/broadcasts", version: API_VERSION.V2 })
export class BroadcastCampaignController {
  readonly #createBroadcastCampaign: Pick<CreateBroadcastCampaignUseCase, "execute">;
  readonly #getBroadcastCampaign: Pick<GetBroadcastCampaignUseCase, "execute">;

  constructor(
    createBroadcastCampaign: CreateBroadcastCampaignUseCase,
    getBroadcastCampaign: GetBroadcastCampaignUseCase,
  ) {
    this.#createBroadcastCampaign = createBroadcastCampaign;
    this.#getBroadcastCampaign = getBroadcastCampaign;
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Admin()
  @ThrottleByUser()
  @Throttle({ default: BROADCAST_CREATION_THROTTLE })
  @ApiDoc({
    summary: "브로드캐스트 캠페인 접수",
    operationId: "createBroadcastCampaign",
    description: `대상 필터의 사용자에게 보낼 알림 캠페인을 접수하고 바로 202를 돌려줍니다. 알림 생성과 발송은 백그라운드 작업이 500명씩 나눠 진행합니다.

- \`requestId\`가 같은 재요청은 새로 발송하지 않고 처음 접수한 캠페인을 돌려줍니다. 내용이 다르면 409(ADMIN_1405)입니다.
- \`localizedContent\`에 언어별 제목·본문을 주면 수신자 언어로 보냅니다. 없는 언어는 \`title\`·\`body\`로 보냅니다.
- \`delivery\`가 \`RECIPIENT_LOCAL_TIME\`이면 수신자 저장 시간대의 \`date\` \`localTime\`에 알림을 만듭니다. 이미 지났으면 다음 날 같은 시각입니다. 기본은 \`NOW\`입니다.
- 진행과 전달 결과는 \`GET /v2/admin/notifications/broadcasts/{campaignId}\`로 확인합니다.
- 관리자마다 분당 ${BROADCAST_CREATION_THROTTLE.limit}회까지 접수합니다.`,
  })
  @ApiSuccessResponse({
    status: HttpStatus.ACCEPTED,
    description: "접수됨",
    type: BroadcastCampaignAcceptedDto,
  })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  @ApiNotFoundError(ErrorCode.ADMIN_1402)
  @ApiConflictError(ErrorCode.ADMIN_1405)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async create(
    @Body({ schema: CreateBroadcastCampaignDto }) dto: CreateBroadcastCampaignDto,
  ): Promise<BroadcastCampaignAcceptedDto> {
    const { campaign } = await this.#createBroadcastCampaign.execute({
      requestId: dto.requestId,
      title: dto.title,
      body: dto.body,
      ...(dto.localizedContent != null && { localizedContent: dto.localizedContent }),
      targetFilter: dto.targetFilter,
      ...(dto.action != null && { action: dto.action }),
      force: dto.force,
      delivery: dto.delivery,
    });
    return toBroadcastCampaignAcceptedDto(campaign);
  }

  @Get(":campaignId")
  @Admin()
  @ApiDoc({
    summary: "브로드캐스트 캠페인 조회",
    operationId: "getBroadcastCampaign",
    description:
      "캠페인 분배 진행(처리한 대상·대기열에 올린 수)과 사용자별 발송 상태, 기기별 전달 결과를 집계해 돌려줍니다. 전달 결과는 공급자 receipt를 반영하는 1분 주기 작업 뒤에 갱신됩니다.",
  })
  @ApiSuccessResponse({ type: BroadcastCampaignDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiForbiddenError(ErrorCode.ADMIN_1401)
  @ApiNotFoundError(ErrorCode.ADMIN_1404)
  async get(
    @Param({ schema: BroadcastCampaignIdParamDto }) params: BroadcastCampaignIdParamDto,
  ): Promise<BroadcastCampaignDto> {
    return toBroadcastCampaignDto(
      await this.#getBroadcastCampaign.execute({
        campaignId: BroadcastCampaignId.reconstitute(params.campaignId),
      }),
    );
  }
}
