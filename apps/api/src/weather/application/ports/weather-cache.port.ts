import type { WeatherConditions, WeatherForecast } from "./weather-provider.port";

export const WEATHER_CACHE = Symbol("WEATHER_CACHE");

/** 격자 참조 (캐시 키 파생용). */
export interface WeatherGridRef {
	gridX: number;
	gridY: number;
}

/** 배치 예보 저장 항목. */
export interface WeatherForecastEntry extends WeatherGridRef {
	forecast: WeatherForecast;
}

/**
 * Weather 관련 캐시 포트 (cache 인프라 경계)
 *
 * application 계층은 공유 CacheService/CacheKeys 대신 이 포트에만 의존한다.
 * 키 구성·TTL·직렬화는 어댑터가 소유하고, 여기서는 예보 캐시 시맨틱만 노출한다.
 *
 * 예보 저장은 정규(3h)·latest(24h fallback) 두 키를 함께 쓴다. 배치 조회는
 * 입력 순서를 보존해 반환한다(mget 시맨틱). 격자 무효화는 정규 패턴·latest·
 * conditions 키를 함께 지운다.
 */
export interface WeatherCachePort {
	/** 정규 예보 단건 조회. */
	getForecast(
		gridX: number,
		gridY: number,
		baseDate: string,
		baseTime: string,
	): Promise<WeatherForecast | undefined>;

	/** 예보 단건 저장 (정규 3h + latest 24h). */
	saveForecast(
		gridX: number,
		gridY: number,
		baseDate: string,
		baseTime: string,
		forecast: WeatherForecast,
	): Promise<void>;

	/** latest 예보 단건 조회 (프로바이더 실패 시 폴백). */
	getLatestForecast(gridX: number, gridY: number): Promise<WeatherForecast | undefined>;

	/** 정규 예보 배치 조회 (입력 순서 보존). */
	getForecastBatch(
		grids: WeatherGridRef[],
		baseDate: string,
		baseTime: string,
	): Promise<(WeatherForecast | undefined)[]>;

	/** 예보 배치 저장 (각 항목 정규 3h + latest 24h). */
	saveForecastBatch(
		entries: WeatherForecastEntry[],
		baseDate: string,
		baseTime: string,
	): Promise<void>;

	/** latest 예보 배치 조회 (입력 순서 보존). */
	getLatestForecastBatch(grids: WeatherGridRef[]): Promise<(WeatherForecast | undefined)[]>;

	/** 날씨 부가정보(체감온도·자외선·일출입·미세먼지) 조회. */
	getConditions(gridX: number, gridY: number): Promise<WeatherConditions | undefined>;

	/** 날씨 부가정보 저장 (1h TTL). */
	setConditions(gridX: number, gridY: number, conditions: WeatherConditions): Promise<void>;

	/** 격자 캐시 전체 무효화 (정규 예보 패턴 + latest + conditions). */
	invalidateGrid(gridX: number, gridY: number): Promise<void>;
}
