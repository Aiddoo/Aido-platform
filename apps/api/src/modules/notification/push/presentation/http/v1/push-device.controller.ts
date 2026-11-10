import { ErrorCode } from "@aido/api/errors";
import { PUSH_DEVICE_PLATFORM, PUSH_PERMISSION_STATUS } from "@aido/api/vocabulary";
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiParam, ApiTags } from "@nestjs/swagger";
import { match } from "ts-pattern";

import {
  CurrentUser,
  type CurrentUserPayload,
  Public,
} from "#api/modules/identity/identity-auth-http.public";
import { type RequestClient } from "#api/platform/http/request-client/request-client";
import { CurrentRequestClient } from "#api/platform/http/request-client/request-client.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiErrorCodesResponse,
  ApiUnauthorizedError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import {
  ApiCreatedResponse,
  ApiSuccessResponse,
} from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { OptOutMarketingPushUseCase } from "../../../application/use-cases/opt-out-marketing-push.use-case.js";
import { ReportPushDeviceUseCase } from "../../../application/use-cases/report-push-device.use-case.js";
import { UnregisterPushDeviceUseCase } from "../../../application/use-cases/unregister-push-device.use-case.js";
import { PushDeviceMapper } from "./push-device-response.mapper.js";
import {
  MarketingPushOptOutDto,
  MarketingPushOptOutResponseDto,
  PushDeviceParamDto,
  PushDeviceResponseDto,
  RegisterPushTokenDto,
  RegisterTokenResponseDto,
  ReportPushDeviceDto,
  UnregisterPushTokenQueryDto,
} from "./push-device.dto.js";

// 1.14.1 이하 앱이 deviceId 없이 등록할 때 쓰던 값이다
const LEGACY_DEFAULT_DEVICE_ID = "default";

function pushDeviceContext(client: RequestClient) {
  return {
    deviceModel: client.deviceName,
    osVersion: client.osVersion,
    timezone: client.timezone,
    locale: client.locale,
  };
}

// 1.14.1 이하 앱은 deviceId 없이 등록할 수 있어 X-Device-Type으로만 플랫폼을 알 수 있다
function legacyPlatformHint(client: RequestClient) {
  return match(client.platform)
    .with(PUSH_DEVICE_PLATFORM.IOS, PUSH_DEVICE_PLATFORM.ANDROID, (platform) => platform)
    .otherwise(() => undefined);
}

@ApiTags(SWAGGER_TAGS.NOTIFICATIONS)
@ApiBearerAuth()
@Controller("notifications")
export class PushDeviceController {
  readonly #reportPushDevice: ReportPushDeviceUseCase;
  readonly #unregisterPushDevice: UnregisterPushDeviceUseCase;
  readonly #optOutMarketingPush: OptOutMarketingPushUseCase;

  constructor(
    reportPushDevice: ReportPushDeviceUseCase,
    unregisterPushDevice: UnregisterPushDeviceUseCase,
    optOutMarketingPush: OptOutMarketingPushUseCase,
  ) {
    this.#reportPushDevice = reportPushDevice;
    this.#unregisterPushDevice = unregisterPushDevice;
    this.#optOutMarketingPush = optOutMarketingPush;
  }

  @Post("marketing-push/opt-out")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "광고성 앱 푸시 수신 철회",
    operationId: "optOutMarketingPush",
    description:
      "푸시 액션에 포함된 서명 토큰으로 로그인 없이 수신을 철회합니다. 응답의 marketingPushWithdrawnAt(1.15.0+)은 처리한 서버 시각이며, 토큰 유효 여부와 상관없이 항상 줍니다.",
  })
  @ApiSuccessResponse({ type: MarketingPushOptOutResponseDto })
  async optOutMarketingPush(
    @Body({ schema: MarketingPushOptOutDto }) dto: MarketingPushOptOutDto,
  ): Promise<MarketingPushOptOutResponseDto> {
    const { processedAt } = await this.#optOutMarketingPush.execute(dto.token);
    // 토큰 유효 여부를 노출하지 않아 사용자 열거/토큰 탐색을 방지한다. 처리 시각도 항상 같은 모양으로 준다
    return { optedOut: true, marketingPushWithdrawnAt: processedAt.toISOString() };
  }

  @Put("push-devices/:deviceId")
  @HttpCode(HttpStatus.OK)
  @ThrottleByUser()
  @ApiParam({
    name: "deviceId",
    description: "앱이 만든 기기 식별자. ios_ 또는 android_로 시작",
    schema: { type: "string", maxLength: 100 },
    example: "ios_5F2C1E7A-0B9D-4C3E-8A11-2D4F6B8C9E01",
  })
  @ApiDoc({
    summary: "푸시 기기 보고",
    operationId: "reportPushDevice",
    description: `기기 하나의 알림 권한과 Expo 푸시 토큰을 보고합니다. 1.14.2 이상 앱이 로그인 직후·앱 복귀·토큰 변경·언어 변경 때 보냅니다.

- 권한이 GRANTED·PROVISIONAL이고 \`token\`이 있으면 이 기기로 푸시를 보냅니다.
- 권한이 없거나 \`token\`이 null이면 이 기기의 토큰을 지우고 권한 상태만 저장합니다.
- 다른 계정이 쓰던 같은 기기·토큰은 이 사용자로 옮깁니다.
- 플랫폼은 deviceId 접두어로, 시간대·언어는 헤더로 정합니다. 같은 값을 다시 보내도 결과는 같습니다.`,
  })
  @ApiHeader({
    name: "X-Timezone",
    description: '푸시 발송 시간대로 쓸 IANA 시간대 (e.g. "Asia/Seoul"). 없으면 저장된 값을 유지',
    required: false,
    example: "Asia/Seoul",
  })
  @ApiHeader({
    name: "Accept-Language",
    description: '푸시 알림 언어 ("ko" | "en"). 없으면 저장된 값을 유지, 지원하지 않는 언어는 ko',
    required: false,
    example: "ko",
  })
  @ApiHeader({
    name: "X-App-Version",
    description: "토큰과 함께 저장해 앱 버전별 푸시 형식을 고를 때 쓰는 앱 버전",
    required: false,
    example: "1.14.2",
  })
  @ApiSuccessResponse({ type: PushDeviceResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiErrorCodesResponse(HttpStatus.BAD_REQUEST, [
    ErrorCode.NOTIFICATION_1001,
    ErrorCode.NOTIFICATION_1006,
  ])
  async reportPushDevice(
    @CurrentUser() user: CurrentUserPayload,
    @Param({ schema: PushDeviceParamDto }) params: PushDeviceParamDto,
    @Body({ schema: ReportPushDeviceDto }) dto: ReportPushDeviceDto,
    @CurrentRequestClient() client: RequestClient,
  ): Promise<PushDeviceResponseDto> {
    const report = await this.#reportPushDevice.execute({
      ...pushDeviceContext(client),
      userId: user.userId,
      sessionId: user.sessionId,
      deviceId: params.deviceId,
      permission: dto.permission,
      token: dto.token,
      payloadVersion: dto.payloadVersion,
      appVersion: client.appVersion,
    });
    return PushDeviceMapper.toDto(report);
  }

  @Post("token")
  @ApiDoc({
    summary: "푸시 토큰 등록 (1.14.1 이하 앱)",
    operationId: "registerPushToken",
    deprecated: true,
    description: `1.14.1 이하 앱이 권한을 허용한 뒤 토큰을 등록합니다. 새 앱은 \`PUT /v1/notifications/push-devices/{deviceId}\`를 씁니다.

권한은 허용(GRANTED)으로 저장하고, 플랫폼은 deviceId 접두어나 \`X-Device-Type\` 헤더로 정합니다. 둘 다 없으면 400 NOTIFICATION_1006입니다(출시된 앱은 항상 접두어를 보냅니다). 같은 deviceId의 토큰은 갱신됩니다. 최소 지원 버전이 1.14.2가 되면 제거합니다.`,
  })
  @ApiHeader({
    name: "X-Timezone",
    description: '푸시 발송 시간대로 쓸 IANA 시간대 (e.g. "Asia/Seoul"). 없으면 저장된 값을 유지',
    required: false,
    example: "Asia/Seoul",
  })
  @ApiHeader({
    name: "Accept-Language",
    description: '푸시 알림 언어 ("ko" | "en"). 없으면 저장된 값을 유지, 지원하지 않는 언어는 ko',
    required: false,
    example: "ko",
  })
  @ApiCreatedResponse({ type: RegisterTokenResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  @ApiBadRequestError(ErrorCode.NOTIFICATION_1001)
  async registerToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: RegisterPushTokenDto }) dto: RegisterPushTokenDto,
    @CurrentRequestClient() client: RequestClient,
  ): Promise<RegisterTokenResponseDto> {
    await this.#reportPushDevice.execute({
      ...pushDeviceContext(client),
      userId: user.userId,
      sessionId: user.sessionId,
      deviceId: dto.deviceId ?? LEGACY_DEFAULT_DEVICE_ID,
      platformHint: legacyPlatformHint(client),
      permission: { status: PUSH_PERMISSION_STATUS.GRANTED, canAskAgain: false },
      token: dto.token,
      payloadVersion: dto.payloadVersion,
      appVersion: dto.appVersion ?? client.appVersion,
    });
    return { message: "푸시 토큰이 등록되었습니다.", registered: true };
  }

  @Delete("token")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "푸시 기기 해제",
    operationId: "unregisterPushToken",
    description: `로그아웃한 기기를 푸시 대상에서 뺍니다. 기기의 토큰과 권한 기록을 함께 지웁니다.

**쿼리 파라미터**
- \`deviceId\` (선택): 이 기기만 해제. 없으면 사용자의 모든 기기를 해제
- 등록되지 않은 기기여도 성공으로 응답합니다.`,
  })
  @ApiSuccessResponse({ type: RegisterTokenResponseDto })
  @ApiUnauthorizedError(ErrorCode.AUTH_0107)
  async unregisterToken(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: UnregisterPushTokenQueryDto }) query: UnregisterPushTokenQueryDto,
  ): Promise<RegisterTokenResponseDto> {
    await this.#unregisterPushDevice.execute(user.userId, query.deviceId);
    return { message: "푸시 토큰이 해제되었습니다.", registered: false };
  }
}
