import { toCompactDateString } from "@/common/date/utils/format";
import type {
	DailyForecast,
	HourlyForecast,
	WeatherForecast,
} from "../weather-provider.interface";
import { KMA_CATEGORY, PTY_CODE_MAP, SKY_CODE_MAP } from "./kma.constants";

export interface KmaResponseItem {
	category: string;
	fcstDate: string;
	fcstTime: string;
	fcstValue: string;
}

export interface KmaApiResponse {
	response: {
		header: {
			resultCode: string;
			resultMsg: string;
		};
		body?: {
			items?: {
				item?: KmaResponseItem[];
			};
			numOfRows?: number;
			pageNo?: number;
			totalCount?: number;
		};
	};
}

/**
 * YYYYMMDD 형식을 YYYY-MM-DD로 변환
 */
function formatDateString(yyyymmdd: string): string {
	return `${yyyymmdd.substring(0, 4)}-${yyyymmdd.substring(4, 6)}-${yyyymmdd.substring(6, 8)}`;
}

/**
 * non-zero PTY 코드 중 가장 빈도 높은 코드를 반환 (없으면 "0")
 */
function mostFrequentPty(ptyCounts: Map<string, number>): string {
	let dominantPty = "0";
	let maxCount = 0;
	for (const [code, count] of ptyCounts) {
		if (count > maxCount) {
			maxCount = count;
			dominantPty = code;
		}
	}
	return dominantPty;
}

/**
 * 특정 날짜의 아이템들로부터 DailyForecast를 생성
 */
function buildDailyForecast(
	dateStr: string,
	dateItems: KmaResponseItem[],
): DailyForecast {
	let tempMin = Number.POSITIVE_INFINITY;
	let tempMax = Number.NEGATIVE_INFINITY;
	let maxPrecipProb = 0;
	const skyCounts = new Map<string, number>();
	const ptyCounts = new Map<string, number>();

	for (const item of dateItems) {
		const value = item.fcstValue;

		switch (item.category) {
			case KMA_CATEGORY.TMP: {
				const temp = Number.parseFloat(value);
				if (!Number.isNaN(temp)) {
					tempMin = Math.min(tempMin, temp);
					tempMax = Math.max(tempMax, temp);
				}
				break;
			}
			case KMA_CATEGORY.TMN: {
				const v = Number.parseFloat(value);
				if (!Number.isNaN(v)) tempMin = Math.min(tempMin, v);
				break;
			}
			case KMA_CATEGORY.TMX: {
				const v = Number.parseFloat(value);
				if (!Number.isNaN(v)) tempMax = Math.max(tempMax, v);
				break;
			}
			case KMA_CATEGORY.POP: {
				const prob = Number.parseInt(value, 10);
				if (!Number.isNaN(prob)) {
					maxPrecipProb = Math.max(maxPrecipProb, prob);
				}
				break;
			}
			case KMA_CATEGORY.SKY: {
				skyCounts.set(value, (skyCounts.get(value) ?? 0) + 1);
				break;
			}
			case KMA_CATEGORY.PTY: {
				if (value !== "0") {
					ptyCounts.set(value, (ptyCounts.get(value) ?? 0) + 1);
				}
				break;
			}
		}
	}

	// 가장 빈도 높은 SKY 코드
	let mostCommonSky = "1";
	let maxSkyCount = 0;
	for (const [code, count] of skyCounts) {
		if (count > maxSkyCount) {
			maxSkyCount = count;
			mostCommonSky = code;
		}
	}

	return {
		date: formatDateString(dateStr),
		skyCondition: SKY_CODE_MAP[mostCommonSky] ?? "CLEAR",
		precipitationType: PTY_CODE_MAP[mostFrequentPty(ptyCounts)] ?? "NONE",
		precipitationProbability: maxPrecipProb,
		temperatureMin: tempMin === Number.POSITIVE_INFINITY ? 0 : tempMin,
		temperatureMax: tempMax === Number.NEGATIVE_INFINITY ? 0 : tempMax,
	};
}

/**
 * 기상청 단기예보 응답을 WeatherForecast로 변환
 */
export function parseKmaResponse(
	data: KmaApiResponse,
	targetDate: Date,
): WeatherForecast {
	const allItems = data.response.body?.items?.item ?? [];
	const targetDateStr = toCompactDateString(targetDate);
	const nextDay = new Date(targetDate);
	nextDay.setDate(nextDay.getDate() + 1);
	const nextDateStr = toCompactDateString(nextDay);

	// 시간별 데이터 수집 (대상 날짜 + 다음 날)
	const hourlyMap = new Map<
		number,
		{
			temperature: number;
			skyCondition: string;
			precipitationProbability: number;
			precipitationAmount: number;
			snowAmount: number;
		}
	>();

	let tempMin = Number.POSITIVE_INFINITY;
	let tempMax = Number.NEGATIVE_INFINITY;
	let maxPrecipProb = 0;
	let dominantSky = "1"; // 기본: 맑음
	const ptyCounts = new Map<string, number>(); // non-zero PTY 빈도
	let avgHumidity = 0;
	let avgWindSpeed = 0;
	let humidityCount = 0;
	let windCount = 0;

	const relevantItems = allItems.filter(
		(item) => item.fcstDate === targetDateStr || item.fcstDate === nextDateStr,
	);

	for (const item of relevantItems) {
		const hour = Number.parseInt(item.fcstTime.substring(0, 2), 10);
		const value = item.fcstValue;
		const isNextDay = item.fcstDate === nextDateStr;
		const key = isNextDay ? 24 + hour : hour;

		const getOrCreate = () =>
			hourlyMap.get(key) ?? {
				temperature: 0,
				skyCondition: "CLEAR",
				precipitationProbability: 0,
				precipitationAmount: 0,
				snowAmount: 0,
			};

		switch (item.category) {
			case KMA_CATEGORY.TMP: {
				const temp = Number.parseFloat(value);
				if (!Number.isNaN(temp)) {
					const entry = getOrCreate();
					entry.temperature = temp;
					hourlyMap.set(key, entry);
				}
				break;
			}
			case KMA_CATEGORY.POP: {
				const prob = Number.parseInt(value, 10);
				if (!Number.isNaN(prob)) {
					if (!isNextDay) maxPrecipProb = Math.max(maxPrecipProb, prob);
					const entry = getOrCreate();
					entry.precipitationProbability = prob;
					hourlyMap.set(key, entry);
				}
				break;
			}
			case KMA_CATEGORY.SKY: {
				if (!isNextDay) dominantSky = value;
				const entry = getOrCreate();
				entry.skyCondition = SKY_CODE_MAP[value] ?? "CLEAR";
				hourlyMap.set(key, entry);
				break;
			}
			case KMA_CATEGORY.PCP: {
				const amount = Number.parseFloat(value);
				if (!Number.isNaN(amount)) {
					const entry = getOrCreate();
					entry.precipitationAmount = amount;
					hourlyMap.set(key, entry);
				}
				break;
			}
			case KMA_CATEGORY.SNO: {
				const amount = Number.parseFloat(value);
				if (!Number.isNaN(amount)) {
					const entry = getOrCreate();
					entry.snowAmount = amount;
					hourlyMap.set(key, entry);
				}
				break;
			}
			case KMA_CATEGORY.TMN: {
				if (!isNextDay) {
					const v = Number.parseFloat(value);
					if (!Number.isNaN(v)) tempMin = Math.min(tempMin, v);
				}
				break;
			}
			case KMA_CATEGORY.TMX: {
				if (!isNextDay) {
					const v = Number.parseFloat(value);
					if (!Number.isNaN(v)) tempMax = Math.max(tempMax, v);
				}
				break;
			}
			case KMA_CATEGORY.PTY: {
				if (!isNextDay && value !== "0") {
					ptyCounts.set(value, (ptyCounts.get(value) ?? 0) + 1);
				}
				break;
			}
			case KMA_CATEGORY.REH: {
				if (!isNextDay) {
					const v = Number.parseInt(value, 10);
					if (!Number.isNaN(v)) {
						avgHumidity += v;
						humidityCount++;
					}
				}
				break;
			}
			case KMA_CATEGORY.WSD: {
				if (!isNextDay) {
					const v = Number.parseFloat(value);
					if (!Number.isNaN(v)) {
						avgWindSpeed += v;
						windCount++;
					}
				}
				break;
			}
		}
	}

	// TMN/TMX가 없으면 시간별 기온에서 추출
	if (
		tempMin === Number.POSITIVE_INFINITY ||
		tempMax === Number.NEGATIVE_INFINITY
	) {
		for (const entry of hourlyMap.values()) {
			if (entry.temperature !== 0) {
				tempMin = Math.min(tempMin, entry.temperature);
				tempMax = Math.max(tempMax, entry.temperature);
			}
		}
	}

	// 시간별 예보 배열 생성 (24+hour → hour % 24 변환)
	const hourlyForecasts: HourlyForecast[] = [...hourlyMap.entries()]
		.sort(([a], [b]) => a - b)
		.map(([hour, data]) => ({
			hour: hour % 24,
			temperature: data.temperature,
			skyCondition: data.skyCondition,
			precipitationProbability: data.precipitationProbability,
			precipitationAmount: data.precipitationAmount,
			snowAmount: data.snowAmount,
		}));

	// 일별 예보 생성 (모든 날짜 대상)
	const dateItemsMap = new Map<string, KmaResponseItem[]>();
	for (const item of allItems) {
		const existing = dateItemsMap.get(item.fcstDate) ?? [];
		existing.push(item);
		dateItemsMap.set(item.fcstDate, existing);
	}

	const dailyForecasts: DailyForecast[] = [...dateItemsMap.keys()]
		.sort()
		.map((dateStr) => {
			const items = dateItemsMap.get(dateStr);
			if (!items) return buildDailyForecast(dateStr, []);
			return buildDailyForecast(dateStr, items);
		});

	return {
		date: targetDate,
		skyCondition: SKY_CODE_MAP[dominantSky] ?? "CLEAR",
		precipitationType: PTY_CODE_MAP[mostFrequentPty(ptyCounts)] ?? "NONE",
		precipitationProbability: maxPrecipProb,
		temperatureMin: tempMin === Number.POSITIVE_INFINITY ? 0 : tempMin,
		temperatureMax: tempMax === Number.NEGATIVE_INFINITY ? 0 : tempMax,
		humidity: humidityCount > 0 ? Math.round(avgHumidity / humidityCount) : 0,
		windSpeed:
			windCount > 0 ? Math.round((avgWindSpeed / windCount) * 10) / 10 : 0,
		hourlyForecasts,
		dailyForecasts,
	};
}
