import { Injectable, Logger } from "@nestjs/common";

import { TypedConfigService } from "@/common/config/services/config.service";
import { toCompactDateHourString } from "@/common/date/utils/format";

import type {
	LifestyleIndex,
	LifestyleIndexProvider,
} from "./lifestyle-index.types";

interface UvIndexResponse {
	response?: {
		header?: {
			resultCode?: string;
		};
		body?: {
			items?: {
				item?: Array<{
					h0?: string;
				}>;
			};
		};
	};
}

@Injectable()
export class KmaLifestyleIndexProvider implements LifestyleIndexProvider {
	readonly #logger = new Logger(KmaLifestyleIndexProvider.name);

	constructor(private readonly configService: TypedConfigService) {}

	async getIndex(
		_lat: number,
		_lon: number,
		date: Date,
		currentTemp: number,
		windSpeed: number,
	): Promise<LifestyleIndex | null> {
		try {
			const apiKey = this.configService.dataGoKrApiKey;
			if (!apiKey) {
				this.#logger.warn("KMA_API_KEY is not configured");
				return null;
			}

			const uvIndex = await this.#fetchUvIndex(apiKey, date);
			const feelsLikeTemperature = this.#calculateFeelsLikeTemperature(
				currentTemp,
				windSpeed,
			);

			return {
				feelsLikeTemperature,
				uvIndex: uvIndex ?? 0,
			};
		} catch (error) {
			this.#logger.warn(
				`Failed to get lifestyle index: ${error instanceof Error ? error.message : String(error)}`,
			);
			return null;
		}
	}

	async #fetchUvIndex(apiKey: string, date: Date): Promise<number | null> {
		const time = toCompactDateHourString(date);

		const url = new URL(
			"https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4",
		);
		url.searchParams.set("serviceKey", apiKey);
		url.searchParams.set("numOfRows", "10");
		url.searchParams.set("dataType", "JSON");
		url.searchParams.set("areaNo", "1100000000");
		url.searchParams.set("time", time);

		const response = await fetch(url.toString(), {
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			this.#logger.warn(`UV Index API error: status=${response.status}`);
			return null;
		}

		const raw: unknown = await response.json();
		const data = raw as UvIndexResponse;

		const resultCode = data?.response?.header?.resultCode;
		if (resultCode !== "00") {
			this.#logger.warn(`UV Index API error: resultCode=${resultCode}`);
			return null;
		}

		const items = data?.response?.body?.items?.item;
		if (!items || items.length === 0) {
			this.#logger.warn("UV Index API: no items in response");
			return null;
		}

		const firstItem = items[0];
		if (!firstItem) {
			return null;
		}

		const h0Value = firstItem.h0;
		if (h0Value === undefined || h0Value === null || h0Value === "") {
			this.#logger.warn("UV Index API: h0 value is empty");
			return null;
		}

		const parsed = Number(h0Value);
		if (Number.isNaN(parsed)) {
			this.#logger.warn(`UV Index API: h0 value is not a number: ${h0Value}`);
			return null;
		}

		return parsed;
	}

	#calculateFeelsLikeTemperature(temp: number, windSpeed: number): number {
		// Wind Chill formula applies when temp <= 10°C and windSpeed >= 1.3 km/h
		if (temp <= 10 && windSpeed >= 1.3) {
			const v016 = windSpeed ** 0.16;
			return 13.12 + 0.6215 * temp - 11.37 * v016 + 0.3965 * temp * v016;
		}

		return temp;
	}
}
