import type { WeatherReportResponse } from "@aido/api/contracts/weather";
import { ErrorCode } from "@aido/api/errors";
import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import {
  CurrentUser,
  type CurrentUserPayload,
} from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";
import { Locale } from "#api/platform/http/decorators/locale.decorator";
import { Timezone } from "#api/platform/http/decorators/timezone.decorator";
import { SWAGGER_TAGS } from "#api/platform/http/swagger/constants/swagger.constant";
import {
  ApiNotFoundError,
  ApiServiceUnavailableError,
  ApiTooManyRequestsError,
} from "#api/platform/http/swagger/decorators/api-error.decorator";
import { ApiDoc } from "#api/platform/http/swagger/decorators/api-operation.decorator";
import { ApiSuccessResponse } from "#api/platform/http/swagger/decorators/api-response.decorator";
import { THROTTLED_DESCRIPTION } from "#api/platform/throttle/throttle.constants";
import { ThrottleByUser } from "#api/platform/throttle/user-aware-throttler.guard";
import { type SupportedLocale } from "#api/shared/domain/locale";

import { GetWeatherReportUseCase } from "../../../application/use-cases/get-weather-report.use-case.js";
import { resolveWeatherReportLanguage } from "../../../domain/weather-report-language.domain-service.js";
import { toWeatherReportResponse } from "./weather-report-response.mapper.js";
import { WeatherReportResponseDto } from "./weather.dto.js";

const WEATHER_REPORT_V2_THROTTLE = {
  GET: { default: { ttl: 60_000, limit: 60 } },
} as const;

@ApiTags(SWAGGER_TAGS.WEATHER_V2)
@ApiBearerAuth()
@Controller({ path: "weather", version: API_VERSION.V2 })
export class WeatherV2Controller {
  readonly #getWeatherReport: GetWeatherReportUseCase;

  constructor(getWeatherReport: GetWeatherReportUseCase) {
    this.#getWeatherReport = getWeatherReport;
  }

  @Get()
  @ThrottleByUser()
  @Throttle(WEATHER_REPORT_V2_THROTTLE.GET)
  @ApiHeader({
    name: "Accept-Language",
    required: false,
    description:
      '특보 제목 언어 ("ko" | "en"). 미전송 시 영어, 지원하지 않는 언어는 한국어로 받습니다.',
    example: "ko",
  })
  @ApiDoc({
    summary: "날씨 리포트 조회",
    operationId: "getWeatherReport",
    description: `
등록한 위치의 현재 날씨, 다음 1시간 강수, 시간별·일별 예보, 기상 특보, 대기질을 한 번에 조회합니다.

### 동작
- 위치를 geohash 정밀도 5(약 5km) 칸으로 묶고, Apple WeatherKit에는 사용자 좌표 대신 칸 중심 좌표를 보냅니다. 같은 칸의 요청은 캐시를 공유합니다. 번역되는 문구(특보 제목)가 있는 칸만 언어별로 캐시를 나눕니다.
- 칸마다 제공되는 데이터 종류를 7일 캐시하고 그 종류만 요청합니다. 한국은 다음 1시간 강수와 특보를 제공하지 않아 \`nextHour\`는 null, \`alerts\`는 빈 배열입니다.
- 리포트는 30분 캐시합니다. 지금 강수 중이거나 2시간 안에 강수(확률 50% 이상·다음 1시간 강수 구간)가 예보되면 10분만 캐시합니다. 공급자 호출이 실패하면(429·5xx·인증 거절·4초 시간 초과) 그 칸은 1분 동안 공급자를 부르지 않고, 최근 6시간 안의 마지막 성공 데이터를 돌려줍니다. 이때 \`fetchedAt\`은 공급자가 그 데이터를 읽은 시각입니다.
- 시간별·일별 예보는 응답 시각을 기준으로 지난 구간을 잘라 냅니다.
- \`briefing\`은 오늘 남은 시간 중 시각이 정해진 미완료 할 일이 비·눈(없으면 더운 낮)에 걸리는지 서버가 판단한 값입니다. \`affectedTodoIds\`와 옮길 시간 후보 \`rescheduleOptions\`는 날씨 푸시와 같은 기준(강수 확률 50% 이상, 낮 체감 33°C 이상)이고, 오늘은 \`X-Timezone\`(없으면 위치 시간대)의 달력 날짜입니다. 할 일을 읽지 못하면 \`briefing\`만 빠집니다.
- 대기질은 한국 위치에서만 에어코리아로 조회하고 1시간 캐시합니다. 조회에 실패해도 리포트는 정상 응답하며 \`airQuality\`만 null입니다.

### 요청 조건
- \`PUT /v2/weather/location\`으로 위치를 먼저 등록해야 합니다.
- 특보 제목은 \`Accept-Language\`가 en이면 영어, ko(또는 그 밖의 언어)면 한국어로 받습니다. 헤더가 없으면 영어입니다.
- 사용자마다 분당 60회까지입니다.

### 응답 규칙
- 단위는 기온 °C, 풍속 m/s, 강수량 mm, 강수 강도 mm/h, 기압 hPa, 가시거리 m입니다. 확률·습도·운량은 0~100 정수입니다.
- 시각은 UTC ISO 8601이고, 일별 \`date\`는 위치 시간대의 달력 날짜(YYYY-MM-DD)입니다. \`location.timezone\`은 그 날짜를 정한 시간대(칸 중심 좌표의 시간대)입니다.
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
    @Timezone({ preserveIfMissing: true }) timezone: string | undefined,
  ): Promise<WeatherReportResponse> {
    const result = await this.#getWeatherReport.execute({
      userId: user.userId,
      language: resolveWeatherReportLanguage(locale),
      timezone,
    });
    return toWeatherReportResponse(result);
  }
}
