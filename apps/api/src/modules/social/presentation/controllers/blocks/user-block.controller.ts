import { ErrorCode } from "@aido/api/errors";
import {
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiParam, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { UserIdParamDto } from "#api/platform/http/dtos/index";
import {
  ApiBadRequestError,
  ApiDoc,
  ApiNotFoundError,
  ApiSuccessResponse,
  ApiUnauthorizedError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { toISOString } from "#api/shared/domain/date/utils/format";

import { BlockUser } from "../../../application/use-cases/blocks/block-user.use-case.js";
import { GetBlockedUsers } from "../../../application/use-cases/blocks/get-blocked-users.use-case.js";
import { UnblockUser } from "../../../application/use-cases/blocks/unblock-user.use-case.js";
import { UserBlockMapper } from "../../mappers/blocks/user-block.mapper.js";
import {
  BlockedUsersResponseDto,
  BlockUserResponseDto,
  GetBlockedUsersQueryDto,
  UnblockUserResponseDto,
} from "../../schemas/blocks/index.js";

const USER_ID_PARAM = {
  name: "userId",
  description: "대상 사용자 ID (CUID 25자, 예: clz7x5p8k0005qz0z8z8z8z8z)",
  example: "clz7x5p8k0005qz0z8z8z8z8z",
} as const;

@ApiTags(SWAGGER_TAGS.BLOCKS)
@ApiBearerAuth()
@Controller("blocks")
export class UserBlockController {
  constructor(
    private readonly blockUserUseCase: BlockUser,
    private readonly unblockUserUseCase: UnblockUser,
    private readonly getBlockedUsersUseCase: GetBlockedUsers,
  ) {}

  @Post(":userId")
  @HttpCode(HttpStatus.OK)
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
  async block(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
  ): Promise<BlockUserResponseDto> {
    const result = await this.blockUserUseCase.execute({
      blockerId: user.userId,
      blockedId: params.userId,
    });

    return {
      message: "사용자를 차단했습니다.",
      blockedUserId: result.block.blockedId,
      blockedAt: toISOString(result.block.createdAt),
    };
  }

  @Delete(":userId")
  @HttpCode(HttpStatus.OK)
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
  async unblock(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: UserIdParamDto }) params: UserIdParamDto,
  ): Promise<UnblockUserResponseDto> {
    await this.unblockUserUseCase.execute({
      blockerId: user.userId,
      blockedId: params.userId,
    });

    return { message: "차단을 해제했습니다." };
  }

  @Header("Vary", "Origin, X-App-Version")
  @ApiHeader({
    name: "x-app-version",
    required: false,
    description: "설치된 앱 버전. 미전송 시 기존 프로필 아이콘으로 응답합니다.",
  })
  @Get()
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
    @Headers("x-app-version") appVersion?: string,
  ): Promise<BlockedUsersResponseDto> {
    const result = await this.getBlockedUsersUseCase.execute({
      blockerId: user.userId,
      cursor: query.cursor,
      size: query.limit,
    });

    return {
      items: result.items.map((item) => UserBlockMapper.toBlockedUser(item, appVersion)),
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  }
}
