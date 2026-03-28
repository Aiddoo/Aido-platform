import type {
	HourlyForecast,
	WeatherForecast,
} from "../weather-provider.interface";
import {
	formatKmaDate,
	KMA_CATEGORY,
	PTY_CODE_MAP,
	SKY_CODE_MAP,
} from "./kma.constants";

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
 * 기상청 단기예보 응답을 WeatherForecast로 변환
 */
export function parseKmaResponse(
	data: KmaApiResponse,
	targetDate: Date,
): WeatherForecast {
	const targetDateStr = formatKmaDate(targetDate);
	const items = (data.response.body?.items?.item ?? []).filter(
		(item) => item.fcstDate === targetDateStr,
	);

	// 시간별 데이터 수집
	const hourlyMap = new Map<
		number,
		{
			temperature: number;
			skyCondition: string;
			precipitationProbability: number;
		}
	>();

	let tempMin = Number.POSITIVE_INFINITY;
	let tempMax = Number.NEGATIVE_INFINITY;
	let maxPrecipProb = 0;
	let dominantSky = "1"; // 기본: 맑음
	let dominantPty = "0"; // 기본: 없음
	let avgHumidity = 0;
	let avgWindSpeed = 0;
	let humidityCount = 0;
	let windCount = 0;

	for (const item of items) {
		const hour = Number.parseInt(item.fcstTime.substring(0, 2), 10);
		const value = item.fcstValue;

		switch (item.category) {
			case KMA_CATEGORY.TMP: {
				const temp = Number.parseFloat(value);
				if (!Number.isNaN(temp)) {
					const entry = hourlyMap.get(hour) ?? {
						temperature: 0,
						skyCondition: "CLEAR",
						precipitationProbability: 0,
					};
					entry.temperature = temp;
					hourlyMap.set(hour, entry);
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
					const entry = hourlyMap.get(hour) ?? {
						temperature: 0,
						skyCondition: "CLEAR",
						precipitationProbability: 0,
					};
					entry.precipitationProbability = prob;
					hourlyMap.set(hour, entry);
				}
				break;
			}
			case KMA_CATEGORY.SKY: {
				dominantSky = value;
				const entry = hourlyMap.get(hour) ?? {
					temperature: 0,
					skyCondition: "CLEAR",
					precipitationProbability: 0,
				};
				entry.skyCondition = SKY_CODE_MAP[value] ?? "CLEAR";
				hourlyMap.set(hour, entry);
				break;
			}
			case KMA_CATEGORY.PTY: {
				if (value !== "0") dominantPty = value;
				break;
			}
			case KMA_CATEGORY.REH: {
				const v = Number.parseInt(value, 10);
				if (!Number.isNaN(v)) {
					avgHumidity += v;
					humidityCount++;
				}
				break;
			}
			case KMA_CATEGORY.WSD: {
				const v = Number.parseFloat(value);
				if (!Number.isNaN(v)) {
					avgWindSpeed += v;
					windCount++;
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

	// 시간별 예보 배열 생성
	const hourlyForecasts: HourlyForecast[] = [...hourlyMap.entries()]
		.sort(([a], [b]) => a - b)
		.map(([hour, data]) => ({
			hour,
			temperature: data.temperature,
			skyCondition: data.skyCondition,
			precipitationProbability: data.precipitationProbability,
		}));

	return {
		date: targetDate,
		skyCondition: SKY_CODE_MAP[dominantSky] ?? "CLEAR",
		precipitationType: PTY_CODE_MAP[dominantPty] ?? "NONE",
		precipitationProbability: maxPrecipProb,
		temperatureMin: tempMin === Number.POSITIVE_INFINITY ? 0 : tempMin,
		temperatureMax: tempMax === Number.NEGATIVE_INFINITY ? 0 : tempMax,
		humidity: humidityCount > 0 ? Math.round(avgHumidity / humidityCount) : 0,
		windSpeed:
			windCount > 0 ? Math.round((avgWindSpeed / windCount) * 10) / 10 : 0,
		hourlyForecasts,
	};
}
