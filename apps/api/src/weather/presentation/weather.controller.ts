import { Body, Controller, Get, HttpCode, HttpStatus, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { now } from "@/shared/domain/date/utils/core";
import { parseDateOnly } from "@/shared/domain/date/utils/parse";
import { ApiDoc, ApiSuccessResponse, SWAGGER_TAGS } from "@/shared/presentation/swagger";

import { CurrentUser, type CurrentUserPayload } from "../../auth/presentation/decorators";
import { GetWeatherConditionsUseCase } from "../application/queries/get-weather-conditions/get-weather-conditions.use-case";
import { GetWeatherForecastUseCase } from "../application/queries/get-weather-forecast/get-weather-forecast.use-case";
import { UpsertLocationUseCase } from "../application/use-cases/upsert-location/upsert-location.use-case";
import {
	GetForecastQueryDto,
	LocationResponseDto,
	UpdateLocationDto,
	WeatherConditionsResponseDto,
	WeatherForecastResponseDto,
} from "./dtos";

@ApiTags(SWAGGER_TAGS.WEATHER)
@ApiBearerAuth()
@Controller("weather")
export class WeatherController {
	constructor(
		private readonly upsertLocationUseCase: UpsertLocationUseCase,
		private readonly getWeatherForecastUseCase: GetWeatherForecastUseCase,
		private readonly getWeatherConditionsUseCase: GetWeatherConditionsUseCase,
	) {}

	@Put("location")
	@HttpCode(HttpStatus.OK)
	@ApiDoc({
		summary: "위치 등록/수정",
		operationId: "updateLocation",
		description: `
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
	async updateLocation(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateLocationDto) {
		const location = await this.upsertLocationUseCase.execute({
			userId: user.userId,
			latitude: dto.latitude,
			longitude: dto.longitude,
		});
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
기상청 단기예보 기반 날씨 예보를 조회합니다.

### 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| date | string | N | 예보 날짜 (YYYY-MM-DD). 생략 시 오늘 |

### 응답 구조
- **오늘 요약**: skyCondition, temperatureMin/Max, humidity, windSpeed
- **시간별 예보** (hourlyForecasts): 0~23시, 시간별 기온/하늘/강수확률
- **일별 예보** (dailyForecasts): 오늘 포함 최대 5일

### skyCondition / precipitationType 값
| skyCondition | 의미 |
|-------------|------|
| CLEAR | 맑음 |
| PARTLY_CLOUDY | 구름 많음 |
| CLOUDY | 흐림 |

| precipitationType | 의미 |
|------------------|------|
| NONE | 없음 |
| RAIN | 비 |
| RAIN_SNOW | 비/눈 |
| SNOW | 눈 |
| SHOWER | 소나기 |

### 캐시 및 Fallback 정책
- 3시간 TTL (기상청 발표 주기에 맞춤)
- API 장애 시 최대 24시간 이전 데이터를 fallback으로 반환

### 미래 날짜 조회 시 주의사항
\`date=2026-04-02\` 처럼 미래 날짜를 지정하면, 기상청에 해당 날짜 전용 예보가
아직 없을 경우 **fallback으로 오늘 데이터가 반환**됩니다.
이때 응답의 최상위 필드(skyCondition, temperatureMin 등)는 오늘 기준이지만,
**\`dailyForecasts\` 배열에는 해당 날짜의 예보가 포함**되어 있습니다.

**클라이언트 권장 사용법:**
- 오늘 날씨 → 최상위 필드 + \`hourlyForecasts\` 사용
- 내일 이후 날씨 → \`dailyForecasts\`에서 해당 \`date\`를 찾아 사용
- \`date\` 파라미터를 생략(오늘 기본)하면 항상 최신 데이터 보장

### 00:00 ~ 02:15 데이터 공백
기상청 단기예보는 하루 8회 발표 (02, 05, 08, 11, 14, 17, 20, 23시)하며,
각 발표 시각 + 약 15분 후부터 조회 가능합니다.
**00:00 ~ 02:14** 사이에는 당일 발표 데이터가 없으므로, **전날 23:00 발표 데이터**를 사용합니다.

이 시간대 응답 특성:
- \`hourlyForecasts\`: 0~23시 정상 제공 (전날 23시 발표 기준 예보)
- \`dailyForecasts\`: 첫째 날이 전날 날짜일 수 있음
- \`date\` (최상위): 요청 시점 기준이므로 오늘 날짜

### 에러 코드
| 코드 | 상황 | 클라이언트 처리 |
|------|------|----------------|
| WEATHER_1901 | 기상청 API 장애 + fallback 캐시 없음 | "날씨 정보를 불러올 수 없습니다" 표시 후 재시도 |
| WEATHER_1902 | 위치 미등록 | PUT /weather/location 호출 유도 |
		`,
	})
	@ApiSuccessResponse({ type: WeatherForecastResponseDto })
	async getForecast(@CurrentUser() user: CurrentUserPayload, @Query() query: GetForecastQueryDto) {
		const date = query.date ? parseDateOnly(query.date) : now();
		const { forecast, location } = await this.getWeatherForecastUseCase.execute({
			userId: user.userId,
			date,
		});
		return {
			latitude: location.latitude,
			longitude: location.longitude,
			...forecast,
		};
	}

	@Get("conditions")
	@ApiDoc({
		summary: "날씨 부가 정보 조회",
		operationId: "getWeatherConditions",
		description: `
체감온도, 자외선지수, 일출/일몰, 미세먼지 등 부가 정보를 조회합니다.

### 쿼리 파라미터
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| date | string | N | 조회 날짜 (YYYY-MM-DD). 생략 시 오늘 |

### 응답 필드

| 필드 | 타입 | nullable | 단위 | 설명 |
|------|------|----------|------|------|
| feelsLikeTemperature | number | O | °C | 체감온도 (Wind Chill 공식, 10°C 이하 + 풍속 1.3km/h 이상일 때 적용) |
| uvIndex | number | O | - | 자외선지수 (0~11+, 야간에는 0) |
| sunrise | string | O | HH:mm | 일출 시각 (KST) |
| sunset | string | O | HH:mm | 일몰 시각 (KST) |
| pm10 | number | O | μg/m³ | 미세먼지 (0~600+) |
| pm25 | number | O | μg/m³ | 초미세먼지 (0~500+) |

### 부분 실패 정책 (중요)
3개 외부 API를 병렬 호출하며, **개별 API 실패 시 해당 필드만 \`null\`**로 반환됩니다.
나머지 정상 데이터는 그대로 제공되므로, 클라이언트는 **각 필드를 개별적으로 null 체크**해야 합니다.

| 필드 | 데이터 소스 | null 가능성 |
|------|-----------|------------|
| feelsLikeTemperature | 로컬 계산 (forecast 기온 + Wind Chill 공식) | 거의 없음 (forecast 자체가 실패한 극단적 경우만) |
| uvIndex | 기상청 생활기상지수 API (V4) | 기상청 API 장애, API 키 미설정 |
| sunrise, sunset | 한국천문연구원 KASI API | KASI API 장애 |
| pm10, pm25 | 에어코리아 실시간 측정 API | 에어코리아 API 장애, 측정소 점검 |

### 캐시
- 1시간 TTL (미세먼지 실시간성 기준)

### 00:00 ~ 02:15 체감온도 참고사항
체감온도는 forecast API의 기온/풍속을 기반으로 계산됩니다.
이 시간대에는 forecast가 전날 23:00 발표 데이터를 사용하므로,
체감온도가 실제와 약간 다를 수 있습니다.

### 에러 코드
| 코드 | 상황 | 클라이언트 처리 |
|------|------|----------------|
| WEATHER_1902 | 위치 미등록 | PUT /weather/location 호출 유도 |
		`,
	})
	@ApiSuccessResponse({ type: WeatherConditionsResponseDto })
	async getConditions(
		@CurrentUser() user: CurrentUserPayload,
		@Query() query: GetForecastQueryDto,
	) {
		const date = query.date ? parseDateOnly(query.date) : now();
		return this.getWeatherConditionsUseCase.execute({
			userId: user.userId,
			date,
		});
	}
}
