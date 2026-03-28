import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Put,
	Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { now } from "@/common/date/utils/core";
import { parseDateOnly } from "@/common/date/utils/parse";
import { ApiDoc, ApiSuccessResponse, SWAGGER_TAGS } from "@/common/swagger";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators";

import { GetForecastQueryDto } from "./dtos/get-forecast-query.dto";
import { UpdateLocationDto } from "./dtos/update-location.dto";
import {
	LocationResponseDto,
	WeatherForecastResponseDto,
} from "./dtos/weather-forecast-response.dto";
import { WeatherService } from "./services/weather.service";

@ApiTags(SWAGGER_TAGS.WEATHER)
@ApiBearerAuth()
@Controller("weather")
export class WeatherController {
	constructor(private readonly weatherService: WeatherService) {}

	@Put("location")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "위치 등록/수정",
		operationId: "updateLocation",
		description: `
## 위치 등록/수정

GPS 좌표 (위도/경도)를 서버에 저장합니다.
기상청 격자 좌표로 자동 변환되어 날씨 알림에 사용됩니다.

### 제약
- 위도: 33.0~39.0 (한국 범위)
- 경도: 124.0~132.0 (한국 범위)
		`,
	})
	@ApiSuccessResponse({ type: LocationResponseDto })
	async updateLocation(
		@CurrentUser() user: CurrentUserPayload,
		@Body() dto: UpdateLocationDto,
	) {
		const location = await this.weatherService.upsertLocation(
			user.userId,
			dto.latitude,
			dto.longitude,
		);
		return {
			latitude: location.latitude,
			longitude: location.longitude,
			gridX: location.gridX,
			gridY: location.gridY,
		};
	}

	@Get("forecast")
	@ApiDoc({
		summary: "날씨 예보 조회",
		operationId: "getWeatherForecast",
		description: `
## 날씨 예보 조회

등록된 위치 기반으로 날씨 예보를 조회합니다.
기상청 단기예보 데이터를 사용하며, 3시간 단위로 캐시됩니다.

### 쿼리 파라미터
- \`date\`: 예보 날짜 (YYYY-MM-DD, 생략 시 오늘)

### 사전 조건
- 위치가 등록되어 있어야 합니다 (PUT /weather/location)
		`,
	})
	@ApiSuccessResponse({ type: WeatherForecastResponseDto })
	async getForecast(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetForecastQueryDto,
	) {
		const date = query.date ? parseDateOnly(query.date) : now();
		return this.weatherService.getForecastForUser(user.userId, date);
	}
}
