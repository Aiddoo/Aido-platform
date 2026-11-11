import { ErrorCode } from "@aido/api/errors";
import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiParam, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { UserIdParamDto } from "#api/platform/http/dtos/user-id-param.dto";
import { AppVersion } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiNotFoundError,
  ApiTooManyRequestsError,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { BlockUserUseCase } from "../../../application/use-cases/block-user.use-case.js";
import { GetBlockedUsersUseCase } from "../../../application/use-cases/get-blocked-users.use-case.js";
import { UnblockUserUseCase } from "../../../application/use-cases/unblock-user.use-case.js";
import {
  toBlockedUsersResponse,
  toBlockUserResponse,
  toUnblockUserResponse,
} from "./user-block-response.mapper.js";
import {
  BlockedUsersResponseDto,
  BlockUserResponseDto,
  GetBlockedUsersQueryDto,
  UnblockUserResponseDto,
} from "./user-block.dto.js";

const USER_ID_PARAM = {
  name: "userId",
  description: "대상 사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
  example: "clz7x5p8k0005qz0z8z8z8z8z",
} as const;

const BLOCK_THROTTLE = { ttl: 60_000, limit: 30 } as const;

@ApiTags(SWAGGER_TAGS.BLOCKS)
@ApiBearerAuth()
@Controller({ path: "blocks", version: API_VERSION.V1 })
export class UserBlockController {
  readonly #blockUserUseCase: BlockUserUseCase;
  readonly #unblockUserUseCase: UnblockUserUseCase;
  readonly #getBlockedUsersUseCase: GetBlockedUsersUseCase;

  constructor(
    blockUserUseCase: BlockUserUseCase,
    unblockUserUseCase: UnblockUserUseCase,
    getBlockedUsersUseCase: GetBlockedUsersUseCase,
  ) {
    this.#blockUserUseCase = blockUserUseCase;
    this.#unblockUserUseCase = unblockUserUseCase;
    this.#getBlockedUsersUseCase = getBlockedUsersUseCase;
  }

  @Post(":userId")
  @HttpCode(HttpStatus.OK)
  @ThrottleByUser()
  @Throttle({ default: BLOCK_THROTTLE })
  @ApiParam(USER_ID_PARAM)
  @ApiDoc({
    summary: "사용자 차단",
    operationId: "blockUser",
    description: `사용자를 차단합니다.

차단하면 두 사람의 친구 관계와 대기 중인 친구 요청이 모두 끊깁니다. 이후 서로 친구 요청·콕 찌르기·응원을 보낼 수 없고,
서로의 콕·응원 기록과 댓글은 보이지 않습니다. 차단당한 사용자에게는 알리지 않습니다.

이미 차단한 사용자를 다시 차단해도 성공하며, \`blockedAt\`은 처음 차단한 시각입니다.`,
  })
  @ApiSuccessResponse({ type: BlockUserResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.BLOCK_2201)
  @ApiNotFoundError(ErrorCode.BLOCK_2202)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async block(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
  ): Promise<BlockUserResponseDto> {
    const block = await this.#blockUserUseCase.execute({
      blockerId: user.userId,
      blockedId: params.userId,
    });
    return toBlockUserResponse(block);
  }

  @Delete(":userId")
  @HttpCode(HttpStatus.OK)
  @ThrottleByUser()
  @Throttle({ default: BLOCK_THROTTLE })
  @ApiParam(USER_ID_PARAM)
  @ApiDoc({
    summary: "차단 해제",
    operationId: "unblockUser",
    description: `차단을 해제합니다.

끊긴 친구 관계는 되살아나지 않으며, 다시 친구가 되려면 친구 요청을 새로 보내야 합니다.
차단하지 않은 사용자를 해제해도 성공합니다.`,
  })
  @ApiSuccessResponse({ type: UnblockUserResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async unblock(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
  ): Promise<UnblockUserResponseDto> {
    await this.#unblockUserUseCase.execute({
      blockerId: user.userId,
      blockedId: params.userId,
    });
    return toUnblockUserResponse();
  }

  @Get()
  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @ApiDoc({
    summary: "차단한 사용자 목록",
    operationId: "getBlockedUsers",
    description: `내가 차단한 사용자를 최근에 차단한 순서로 조회합니다. 탈퇴 중인 사용자는 제외합니다.

**쿼리 파라미터**
- \`cursor\`: 이전 응답의 \`nextCursor\`
- \`limit\`: 페이지 크기 (1-50, 기본값: 20)`,
  })
  @ApiSuccessResponse({ type: BlockedUsersResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async getBlockedUsers(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetBlockedUsersQueryDto }) query: GetBlockedUsersQueryDto,
    @AppVersion() appVersion?: string,
  ): Promise<BlockedUsersResponseDto> {
    const list = await this.#getBlockedUsersUseCase.execute({
      blockerId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });
    return toBlockedUsersResponse(list, appVersion);
  }
}
