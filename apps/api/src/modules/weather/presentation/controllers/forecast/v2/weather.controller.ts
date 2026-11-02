import { type WeatherLocationResponse, type WeatherReportResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { Body, Controller, Get, HttpCode, HttpStatus, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Locale, type SupportedLocale } from "#api/platform/http/decorators/index";
import {
  ApiDoc,
  ApiNotFoundError,
  ApiServiceUnavailableError,
  ApiSuccessResponse,
  ApiTooManyRequestsError,
  SWAGGER_TAGS,
} from "#api/platform/http/swagger/index";
import { ThrottleByUser } from "#api/platform/throttle/index";
import { now } from "#api/shared/domain/date/utils/core";

import { resolveWeatherReportLanguage } from "../../../../application/models/forecast/weather-report-language.js";
import { GetWeatherReport } from "../../../../application/use-cases/forecast/get-weather-report.use-case.js";
import { UpsertLocation } from "../../../../application/use-cases/forecast/upsert-location.use-case.js";
import { toWeatherReportResponse } from "../../../mappers/forecast/v2/weather-report.mapper.js";
import {
  UpdateWeatherLocationDto,
  WeatherLocationResponseDto,
  WeatherReportResponseDto,
} from "../../../schemas/forecast/v2/index.js";

/**
 * GET은 저장된 위치만 쓰므로 공급자 호출 수를 늘리는 수단은 위치 변경이다. 위치 변경을 더 좁게
 * 막아 먼 좌표를 바꿔 가며 새 칸을 만드는 요청이 WeatherKit 월 호출량을 쓰지 못하게 한다.
 */
export const WEATHER_V2_THROTTLE = {
  UPDATE_LOCATION: { default: { ttl: 60_000, limit: 10 } },
  GET_REPORT: { default: { ttl: 60_000, limit: 60 } },
} as const;

const THROTTLED_DESCRIPTION = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";

@ApiTags(SWAGGER_TAGS.WEATHER_V2)
@ApiBearerAuth()
@Controller({ path: "weather", version: API_VERSION.V2 })
export class WeatherV2Controller {
  constructor(
    private readonly upsertLocation: UpsertLocation,
    private readonly getWeatherReport: GetWeatherReport,
  ) {}

  @Put("location")
  @HttpCode(HttpStatus.OK)
  @ThrottleByUser()
  @Throttle(WEATHER_V2_THROTTLE.UPDATE_LOCATION)
  @ApiDoc({
    summary: "날씨 위치 등록",
    operationId: "updateWeatherLocation",
    description: `
날씨 리포트와 날씨 알림의 기준 위치를 저장합니다.

### 동작
- 전 세계 좌표를 받고, 좌표의 IANA 시간대를 계산해 함께 저장합니다.
- 한국 범위(위도 33.0~39.0, 경도 124.0~132.0) 안이면 기상청 격자도 저장합니다. 그래서 v1 예보와 오전·오후 날씨 알림이 그대로 동작합니다.
- 한국 밖 위치는 기상청 격자가 없으므로 오전·오후 날씨 알림을 보내지 않습니다.
- 사용자당 위치는 하나이며, 같은 요청을 반복해도 결과가 같습니다.

### 요청 조건
- 사용자마다 분당 10회까지입니다.

### 응답 규칙
- \`timezone\`은 저장한 위치의 IANA 시간대입니다.

### 오류
| 코드 | 상태 | 언제 | 클라이언트 대응 |
|------|------|------|----------------|
| SYS_0002 | 400 | 위도·경도가 범위를 벗어났거나 숫자가 아닐 때 | 좌표를 다시 받아 재요청합니다 |
| SYS_0001 | 429 | 분당 요청 한도를 넘었을 때 | 위치가 크게 바뀔 때만 다시 등록합니다 |
`,
  })
  @ApiSuccessResponse({ type: WeatherLocationResponseDto })
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  async updateLocation(
    @CurrentUser() user: CurrentUserPayload,
    @Body({ schema: UpdateWeatherLocationDto }) dto: UpdateWeatherLocationDto,
  ): Promise<WeatherLocationResponse> {
    const { location, timezone } = await this.upsertLocation.execute({
      userId: user.userId,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
    return { latitude: location.latitude, longitude: location.longitude, timezone };
  }

  @Get()
  @ThrottleByUser()
  @Throttle(WEATHER_V2_THROTTLE.GET_REPORT)
  @ApiDoc({
    summary: "날씨 리포트 조회",
    operationId: "getWeatherReport",
    description: `
등록한 위치의 현재 날씨, 다음 1시간 강수, 시간별·일별 예보, 기상 특보, 대기질을 한 번에 조회합니다.

### 동작
- 위치를 geohash 정밀도 5(약 5km) 칸으로 묶고, Apple WeatherKit에는 사용자 좌표 대신 칸 중심 좌표를 보냅니다. 같은 칸·같은 언어의 요청은 캐시를 공유합니다.
- 칸마다 제공되는 데이터 종류를 7일 캐시하고 그 종류만 요청합니다. 한국은 다음 1시간 강수와 특보를 제공하지 않아 \`nextHour\`는 null, \`alerts\`는 빈 배열입니다.
- 리포트는 15분 캐시합니다. 공급자 호출이 실패하면(429·5xx·인증 거절·4초 시간 초과) 그 칸은 1분 동안 공급자를 부르지 않고, 최근 6시간 안의 마지막 성공 데이터를 돌려줍니다. 이때 \`fetchedAt\`은 공급자가 그 데이터를 읽은 시각입니다.
- 시간별·일별 예보는 응답 시각을 기준으로 지난 구간을 잘라 냅니다.
- 대기질은 한국 위치에서만 에어코리아로 조회하고 1시간 캐시합니다. 조회에 실패해도 리포트는 정상 응답하며 \`airQuality\`만 null입니다.

### 요청 조건
- \`PUT /v2/weather/location\`으로 위치를 먼저 등록해야 합니다.
- 특보 제목은 \`Accept-Language\`가 en이면 영어, ko(또는 그 밖의 언어)면 한국어로 받습니다. 헤더가 없으면 영어입니다.
- 사용자마다 분당 60회까지입니다.

### 응답 규칙
- 단위는 기온 °C, 풍속 m/s, 강수량 mm, 강수 강도 mm/h, 기압 hPa, 가시거리 m입니다. 확률·습도·운량은 0~100 정수입니다.
- 시각은 UTC ISO 8601이고, 일별 \`date\`는 위치 시간대의 달력 날짜(YYYY-MM-DD)입니다.
- 값이 없으면 키를 빼지 않고 null로 보냅니다. \`nextHour\`·\`airQuality\`가 null이면 그 지역에서 제공하지 않거나 이번 조회에서 받지 못한 것입니다.

### 책임 분담
| 서버가 계산 | 앱이 계산 |
|------------|----------|
| 공급자 인증·호출·장애 시 이전 데이터 사용, \`fetchedAt\` | 표시 문구, 화씨 변환 |
| 미터법·0~100 정수로 단위 정규화 | "N분 뒤 비" 같은 강수 시작 안내 |
| 칸·캐시, 위치 시간대와 일별 \`date\` | 브리핑·배경 장면 |
| 한국 대기질 병합, 특보 심각도 정렬 | 대기질 등급, 데이터 경과 시간 표시 |

### 오류
| 코드 | 상태 | 언제 | 클라이언트 대응 |
|------|------|------|----------------|
| WEATHER_1902 | 404 | 위치를 등록하지 않았을 때 | 위치 권한을 받은 뒤 \`PUT /v2/weather/location\`을 호출합니다 |
| SYS_0001 | 429 | 분당 요청 한도를 넘었을 때 | 잠시 뒤 다시 조회합니다 |
| WEATHER_1901 | 503 | 공급자 호출이 실패했고 6시간 안의 이전 데이터도 없을 때 | 오류 화면에 다시 시도를 제공합니다 |
`,
  })
  @ApiSuccessResponse({ type: WeatherReportResponseDto })
  @ApiNotFoundError(ErrorCode.WEATHER_1902)
  @ApiTooManyRequestsError(ErrorCode.SYS_0001, THROTTLED_DESCRIPTION)
  @ApiServiceUnavailableError(ErrorCode.WEATHER_1901)
  async getReport(
    @CurrentUser() user: CurrentUserPayload,
    @Locale() locale: SupportedLocale | undefined,
  ): Promise<WeatherReportResponse> {
    const result = await this.getWeatherReport.execute({
      userId: user.userId,
      language: resolveWeatherReportLanguage(locale),
      now: now(),
    });
    return toWeatherReportResponse(result);
  }
}
