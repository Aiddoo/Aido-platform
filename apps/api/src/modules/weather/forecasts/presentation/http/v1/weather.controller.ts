import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { GetWeatherConditionsUseCase } from "../../../application/use-cases/get-weather-conditions.use-case.js";
import { GetWeatherForecastUseCase } from "../../../application/use-cases/get-weather-forecast.use-case.js";
import { toWeatherForecastResponse } from "./weather-forecast-response.mapper.js";
import {
  GetForecastQueryDto,
  WeatherConditionsResponseDto,
  WeatherForecastResponseDto,
} from "./weather.dto.js";

// v1 앱이 보낸 날짜는 그 날 UTC 자정(KST 09:00)으로 해석해 왔다
function utcMidnightOf(date: string): Temporal.Instant {
  return Temporal.PlainDate.from(date).toZonedDateTime("UTC").toInstant();
}

@ApiTags(SWAGGER_TAGS.WEATHER_V1)
@ApiBearerAuth()
@Controller({ path: "weather", version: API_VERSION.V1 })
export class WeatherController {
  readonly #getWeatherForecast: GetWeatherForecastUseCase;
  readonly #getWeatherConditions: GetWeatherConditionsUseCase;
  readonly #clock: ClockPort;

  constructor(
    getWeatherForecast: GetWeatherForecastUseCase,
    getWeatherConditions: GetWeatherConditionsUseCase,
    clock: ClockPort,
  ) {
    this.#getWeatherForecast = getWeatherForecast;
    this.#getWeatherConditions = getWeatherConditions;
    this.#clock = clock;
  }

  @Get("forecast")
  @ApiDoc({
    summary: "날씨 예보 조회",
    operationId: "getWeatherForecast",
    deprecated: true,
    description: `
> **Deprecated** · 1.13.1 이하 앱 전용입니다. 1.14.0부터는 \`/v2/weather\`를 사용합니다. 1.13.1 이하 앱 사용자가 사라지면 제거합니다.
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

### 조회할 수 있는 날짜
기상청 단기예보는 오늘을 포함한 최근 3일의 발표만 주고, 한 발표는 발표일부터 모레까지를 예보합니다.
그래서 \`date\`는 오늘(KST) 기준 이틀 전부터 모레까지만 받습니다.
- 아직 발표되지 않은 시각에 해당하는 날짜(예: 새벽의 오늘, 내일·모레)는 지금의 최신 발표로 조회합니다.
- 범위 밖 날짜는 기상청을 호출하지 않고 400 SYS_0002로 응답합니다.

**클라이언트 권장 사용법:**
- 오늘 날씨 → 최상위 필드 + \`hourlyForecasts\` 사용
- 내일 이후 날씨 → \`dailyForecasts\`에서 해당 \`date\`를 찾아 사용

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
| SYS_0002 | 기상청이 제공하지 않는 \`date\` (오늘 기준 이틀 전보다 이르거나 모레보다 늦음) | 오늘 날짜로 다시 조회 |
| WEATHER_1901 | 기상청 API 장애 + fallback 캐시 없음 | "날씨 정보를 불러올 수 없습니다" 표시 후 재시도 |
| WEATHER_1902 | 위치 미등록, 또는 기상청 격자가 없는 한국 밖 위치(\`PUT /v2/weather/location\`으로 저장) | 위치 미등록이면 PUT /weather/location 호출 유도, 해외 위치면 날씨 화면 대신 안내 표시 |
		`,
  })
  @ApiSuccessResponse({ type: WeatherForecastResponseDto })
  async getForecast(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetForecastQueryDto }) query: GetForecastQueryDto,
  ) {
    const result = await this.#getWeatherForecast.execute({
      userId: user.userId,
      target: this.#targetOf(query),
    });
    return toWeatherForecastResponse(result);
  }

  @Get("conditions")
  @ApiDoc({
    summary: "날씨 부가 정보 조회",
    operationId: "getWeatherConditions",
    deprecated: true,
    description: `
> **Deprecated** · 1.13.1 이하 앱 전용입니다. 1.14.0부터는 \`/v2/weather\`를 사용합니다. 1.13.1 이하 앱 사용자가 사라지면 제거합니다.
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
| WEATHER_1902 | 위치 미등록, 또는 기상청 격자가 없는 한국 밖 위치(\`PUT /v2/weather/location\`으로 저장) | 위치 미등록이면 PUT /weather/location 호출 유도, 해외 위치면 날씨 화면 대신 안내 표시 |
		`,
  })
  @ApiSuccessResponse({ type: WeatherConditionsResponseDto })
  async getConditions(
    @CurrentUser() user: CurrentUserPayload,
    @Query({ schema: GetForecastQueryDto }) query: GetForecastQueryDto,
  ) {
    return this.#getWeatherConditions.execute({
      userId: user.userId,
      target: this.#targetOf(query),
    });
  }

  #targetOf(query: GetForecastQueryDto): Temporal.Instant {
    return query.date == null ? this.#clock.now() : utcMidnightOf(query.date);
  }
}
