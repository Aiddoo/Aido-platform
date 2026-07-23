export const WEATHER_PROVIDER = Symbol("WEATHER_PROVIDER");

export interface HourlyForecast {
	hour: number;
	temperature: number;
	skyCondition: string;
	precipitationProbability: number;
	precipitationAmount: number;
	snowAmount: number;
}

export interface DailyForecast {
	date: string; // "YYYY-MM-DD"
	skyCondition: "CLEAR" | "PARTLY_CLOUDY" | "CLOUDY";
	precipitationType: "NONE" | "RAIN" | "RAIN_SNOW" | "SNOW" | "SHOWER";
	precipitationProbability: number;
	temperatureMin: number;
	temperatureMax: number;
}

export interface WeatherForecast {
	date: Date;
	skyCondition: "CLEAR" | "PARTLY_CLOUDY" | "CLOUDY";
	precipitationType: "NONE" | "RAIN" | "RAIN_SNOW" | "SNOW" | "SHOWER";
	precipitationProbability: number;
	temperatureMin: number;
	temperatureMax: number;
	humidity: number;
	windSpeed: number;
	hourlyForecasts: HourlyForecast[];
	dailyForecasts: DailyForecast[];
}

export interface WeatherConditions {
	feelsLikeTemperature: number | null;
	uvIndex: number | null;
	sunrise: string | null;
	sunset: string | null;
	pm10: number | null;
	pm25: number | null;
}

/**
 * 날씨 예보 프로바이더 포트 (벤더 추상화 — 국내/국외 확장 지점)
 *
 * **이 포트는 벤더 중립적이다.** 입력은 WGS84 위경도(lat/lon)뿐이고, 출력은 정규화된
 * `WeatherForecast` DTO(중립적 sky/precip enum)다. 기상청 격자 변환(Lambert 투영)·
 * base_time 산정 같은 KMA 고유 개념은 **어댑터 내부에 캡슐화**되며 이 인터페이스로
 * 새어 나오지 않는다 — 국외 프로바이더(OpenWeatherMap 등)는 격자 없이 lat/lon만으로
 * 구현하면 된다.
 *
 * **국외 확장 계약**: 새 지역 프로바이더는 (1) 이 포트를 구현하고 응답을
 * `WeatherForecast`로 정규화, (2) `name`으로 자신을 식별, (3) `isConfigured()`로
 * 자격 여부를 노출한다. 좌표→프로바이더 선택(지역 라우팅)은 별도 리졸버가 담당할
 * 예정이며(현재는 단일 KMA 바인딩), 그때 도메인 `Coordinate`의 한국 좌표 범위
 * 불변식과 격자 기반 캐시 버킷팅을 지역별로 일반화한다.
 */
export interface WeatherProvider {
	/** 프로바이더 식별자 (예: "kma", "openweathermap") — 지역 라우팅·로깅용. */
	readonly name: string;
	/** WGS84 위경도로 예보를 조회한다 (격자 변환은 어댑터 내부 책임). */
	getForecast(lat: number, lon: number, date: Date): Promise<WeatherForecast>;
	/** 필수 자격(API 키 등) 구성 여부 — 지역 라우팅 시 가용성 판단. */
	isConfigured(): boolean;
}
