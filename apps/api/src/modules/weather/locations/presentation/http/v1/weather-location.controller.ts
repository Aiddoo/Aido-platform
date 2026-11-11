import { Body, Controller, HttpCode, HttpStatus, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";

import { UpsertUserLocationUseCase } from "../../../application/use-cases/upsert-user-location.use-case.js";
import { LocationResponseDto, UpdateLocationDto } from "./weather-location.dto.js";

@ApiTags(SWAGGER_TAGS.WEATHER_V1)
@ApiBearerAuth()
@Controller({ path: "weather", version: API_VERSION.V1 })
export class WeatherLocationController {
  readonly #upsertLocation: UpsertUserLocationUseCase;

  constructor(upsertLocation: UpsertUserLocationUseCase) {
    this.#upsertLocation = upsertLocation;
  }

  @Put("location")
  @HttpCode(HttpStatus.OK)
  @ApiDoc({
    summary: "위치 등록/수정",
    operationId: "updateLocation",
    deprecated: true,
    description: `
> **Deprecated** · 1.13.1 이하 앱 전용입니다. 1.14.0부터는 \`/v2/weather\`를 사용합니다. 1.13.1 이하 앱 사용자가 사라지면 제거합니다.
GPS 좌표를 서버에 저장합니다. 기상청 격자 좌표(Lambert 투영)로 자동 변환됩니다.
날씨 예보, 부가 정보 조회, 오전/오후 날씨 알림의 기준 위치로 사용됩니다.

**위치를 등록해야 forecast, conditions API를 사용할 수 있습니다.**

### 좌표 범위 (한국)
| 파라미터 | 최솟값 | 최댓값 |
|---------|-------|-------|
| latitude | 33.0 | 39.0 |
| longitude | 124.0 | 132.0 |

### 응답 필드
- \`gridX\`, \`gridY\`: 기상청 격자 좌표 (내부 캐시 키로 사용, 클라이언트는 무시해도 됨)
		`,
  })
  @ApiSuccessResponse({ type: LocationResponseDto })
  async updateLocation(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: UpdateLocationDto }) dto: UpdateLocationDto,
  ) {
    const { location } = await this.#upsertLocation.execute({
      userId: user.userId,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    // DTO가 한국 범위만 받으므로 격자는 항상 있다.
    const grid = location.requireKmaGrid();
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      gridX: grid.gridX,
      gridY: grid.gridY,
    };
  }
}
