# weather 용어집

날씨(위치·예보·리포트) 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

## locations

| 용어           | 코드                                                                   | 뜻                                                                                                       |
| -------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 날씨 위치      | `UserLocation`(Aggregate)                                              | 사용자당 하나인 날씨 기준 위치. 다시 등록하면 새 위치로 통째로 바뀐다                                    |
| 위치 등록      | `RegisterUserLocationUseCase`                                          | 좌표를 검증하고 칸 중심 시간대와 (한국 예보 범위면) 예보 격자를 함께 저장한다                            |
| 좌표           | `Coordinate`(VO)                                                       | 유한한 WGS84 위도·경도. 범위 밖이면 `SYS_0002`다                                                         |
| 칸             | `GeoCell`(VO)                                                          | geohash 정밀도 5(약 4.9km) 칸. 공급자에는 칸 중심 좌표만 보내고 같은 칸 사용자는 캐시를 나눈다           |
| 위치 시간대    | `timezone`, `TimezoneResolverPort`                                     | 칸 중심 좌표의 IANA 시간대. v2 이전에 저장한 위치는 null이다                                             |
| 한국 예보 범위 | `isKoreanWeatherCovered`·`assertKoreanWeatherCovered`                  | `LATITUDE_RANGE`·`LONGITUDE_RANGE` 안. 예보 격자와 대기질은 이 범위에서만 쓴다                           |
| 예보 격자      | `GridCoordinate`(VO), `WeatherGridResolverPort`, `requireForecastGrid` | 한국 예보 범위 좌표에만 저장하는 v1 예보 격자. 없는 위치로 v1을 부르면 위치 없음과 같은 `WEATHER_1902`다 |

위치는 상태 전이가 없다(등록하면 덮어쓴다).

## forecasts

조회 전용이라 Aggregate가 없다. 리포트는 공급자에서 받은 값 그대로인 VO, v1 예보·부가 정보·공급자 표기는 Read Model이다.

| 용어             | 코드                                                                                    | 뜻                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 날씨 리포트      | `WeatherReport`(VO)                                                                     | 공급자 중립의 현재·다음 1시간·시간별·일별·특보와 공급자가 읽은 순간(`fetchedAt`). 단위는 °C·m/s·mm·hPa·m                  |
| 응답 창          | `windowAt`                                                                              | 지금이 속한 시간부터 시간별 `HOURLY_FORECAST_HOURS`개, 위치 시간대의 오늘부터 일별 `DAILY_FORECAST_DAYS`일만 남긴다       |
| 곧 강수          | `isPrecipitationSoon`                                                                   | 지금 강수 중이거나 2시간 안에 강수 구간·비 오는 시간이 있다. 그때만 리포트 캐시를 30분 대신 10분 둔다                     |
| 리포트 조회      | `GetWeatherReportUseCase`                                                               | 사용자 위치의 리포트·대기질(한국만)·공급자 표기·브리핑. 대기질·할 일 조회가 실패하면 그 값만 비운다                       |
| 칸 리포트 읽기   | `ReadWeatherReportUseCase`                                                              | 칸 캐시 → 공급자 → 마지막 성공 리포트(6시간) 순. 모두 없으면 `WEATHER_1901`이다                                           |
| 묶음 리포트 읽기 | `ReadWeatherReportsUseCase`(`WeatherReportReaderPort`)                                  | 날씨 알림이 같은 칸·언어를 한 번씩만 읽는다. 읽지 못한 키는 결과에서 빠진다                                               |
| 캐시 범위        | `WeatherReportCacheScope`, `SHARED_WEATHER_REPORT_SCOPE`                                | 번역 문구(특보 제목)가 있는 칸만 언어별로, 그 밖은 `shared` 하나로 캐시한다                                               |
| 공급자 표기      | `WeatherReportAttribution`(Read Model)                                                  | 요청 언어의 상표 로고와 출처 고지                                                                                         |
| 날씨 브리핑      | `planWeatherBriefing`, `WeatherBriefing`                                                | 남은 오늘 할 일 중 비 오는 시간(없으면 더운 시간)에 걸린 할 일과, 같은 날 옮길 시간 후보 4개(첫째가 추천)                 |
| 비·더운 시간     | `isWetHour`·`isHotHour`                                                                 | 강수 확률 `WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE` 이상 / 낮 체감 온도 `HOT_APPARENT_TEMPERATURE` 이상                    |
| 날씨 알림 판단   | `decideMorningWeatherBriefing`·`decideEveningWeatherBriefing`                           | 아침은 할 일과 겹친 비·뇌우·눈 → 더위 → 늦게 오는 비 → 요약, 저녁은 내일 비가 시작하는 때·쌀쌀함. 그날 일별이 없으면 null |
| 하루 구분        | `WEATHER_DAY_PARTS`                                                                     | 저녁 알림이 고르는 새벽·오전·오후·저녁(알림 시간대). 경계는 `WEATHER_BRIEFING_RULES`다                                    |
| v1 예보          | `WeatherForecast`(Read Model), `GetWeatherForecastUseCase`                              | 예보 격자의 하루치 예보(1.13.x 이하 앱)                                                                                   |
| 예보 읽기        | `ReadWeatherForecastUseCase`·`ReadWeatherForecastsUseCase`(`WeatherForecastReaderPort`) | 한 격자는 캐시 → 1분 실패 차단 → 공급자 → latest(24시간). 묶음은 AI 제안이 쓰고 읽지 못한 격자는 빠진다                   |
| 발표 시점        | `ForecastTiming`, `resolveAvailability`                                                 | 예보 대상 순간과 그 예보를 받을 발표 순간. 공급자가 줄 수 없는 날짜는 공급자를 부르지 않고 400 `SYS_0002`다               |
| 부가 정보        | `WeatherConditions`, `GetWeatherConditionsUseCase`                                      | 체감온도·자외선·일출입·미세먼지. 공급자 하나가 실패하면 그 값만 null이다                                                  |
