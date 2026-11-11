import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, HttpCode, HttpStatus, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiBadRequestError,
  ApiTooManyRequestsError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";

import { UpsertUserLocationUseCase } from "../../../application/use-cases/upsert-user-location.use-case.js";
import { toWeatherLocationResponse } from "./weather-location-response.mapper.js";
import { UpdateWeatherLocationDto, WeatherLocationResponseDto } from "./weather-location.dto.js";

/**
 * GET은 저장된 위치만 쓰므로 공급자 호출 수를 늘리는 수단은 위치 변경이다. 위치 변경을 더 좁게
 * 막아 먼 좌표를 바꿔 가며 새 칸을 만드는 요청이 WeatherKit 월 호출량을 쓰지 못하게 한다.
 */
export const WEATHER_LOCATION_V2_THROTTLE = {
  UPDATE: { default: { ttl: 60_000, limit: 10 } },
} as const;

@ApiTags(SWAGGER_TAGS.WEATHER_V2)
@ApiBearerAuth()
@Controller({ path: "weather", version: API_VERSION.V2 })
export class WeatherLocationV2Controller {
  readonly #upsertLocation: UpsertUserLocationUseCase;

  constructor(upsertLocation: UpsertUserLocationUseCase) {
    this.#upsertLocation = upsertLocation;
  }

  @Put("location")
  @HttpCode(HttpStatus.OK)
  @ThrottleByUser()
  @Throttle(WEATHER_LOCATION_V2_THROTTLE.UPDATE)
  @ApiDoc({
    summary: "날씨 위치 등록",
    operationId: "updateWeatherLocation",
    description: `
날씨 리포트와 날씨 알림의 기준 위치를 저장합니다.

### 동작
- 전 세계 좌표를 받고, 좌표의 IANA 시간대를 계산해 함께 저장합니다.
- 한국 범위(위도 33.0~39.0, 경도 124.0~132.0) 안이면 기상청 격자도 저장합니다. 격자는 v1 예보(1.13.x 이하 앱)와 AI 제안이 씁니다.
- 오전·오후 날씨 알림은 이 API와 같은 v2 리포트로 만들므로 한국 밖 위치도 받습니다. 한국 밖 위치는 격자가 없어 v1 예보·부가 정보 조회가 \`WEATHER_1902\`입니다.
- 사용자당 위치는 하나이며, 같은 요청을 반복해도 결과가 같습니다.

### 요청 조건
- 사용자마다 분당 10회까지입니다.

### 응답 규칙
- \`timezone\`은 저장한 위치가 속한 칸 중심의 IANA 시간대로, \`GET /v2/weather\`의 \`location.timezone\`과 같습니다.

### 오류
| 코드 | 상태 | 언제 | 클라이언트 대응 |
|------|------|------|----------------|
| SYS_0002 | 400 | 위도·경도가 범위를 벗어났거나 숫자가 아닐 때 | 좌표를 다시 받아 재요청합니다 |
| SYS_0001 | 429 | 분당 요청 한도를 넘었을 때 | 위치가 크게 바뀔 때만 다시 등록합니다 |
`,
  })
  @ApiSuccessResponse({ type: WeatherLocationResponseDto })
  @ApiBadRequestError(ErrorCode.SYS_0002)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async updateLocation(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: UpdateWeatherLocationDto }) dto: UpdateWeatherLocationDto,
  ) {
    const result = await this.#upsertLocation.execute({
      userId: user.userId,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return toWeatherLocationResponse(result);
  }
}
