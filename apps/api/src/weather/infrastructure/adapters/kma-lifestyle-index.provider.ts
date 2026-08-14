import { Injectable, Logger } from "@nestjs/common";

import { toCompactDateHourString } from "@/shared/domain/date/utils/format";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { readJson } from "@/shared/infrastructure/http/read-json";

import type {
	LifestyleIndex,
	LifestyleIndexProvider,
} from "../../application/ports/lifestyle-index-provider.port";
import { getRegionCode } from "./region-code";

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
		lat: number,
		lon: number,
		date: Date,
		currentTemp: number,
		windSpeed: number,
	): Promise<LifestyleIndex> {
		const feelsLikeTemperature = this.#calculateFeelsLikeTemperature(currentTemp, windSpeed);

		const apiKey = this.configService.dataGoKrApiKey;
		if (!apiKey) {
			this.#logger.warn("KMA_API_KEY is not configured");
			return { feelsLikeTemperature, uvIndex: null };
		}

		try {
			const uvIndex = await this.#fetchUvIndex(apiKey, lat, lon, date);
			return { feelsLikeTemperature, uvIndex };
		} catch (error) {
			this.#logger.warn(
				`Failed to get UV index: ${error instanceof Error ? error.message : String(error)}`,
			);
			return { feelsLikeTemperature, uvIndex: null };
		}
	}

	async #fetchUvIndex(
		apiKey: string,
		lat: number,
		lon: number,
		date: Date,
	): Promise<number | null> {
		const time = toCompactDateHourString(date);

		const url = new URL("https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4");
		url.searchParams.set("serviceKey", apiKey);
		url.searchParams.set("numOfRows", "10");
		url.searchParams.set("dataType", "JSON");
		url.searchParams.set("areaNo", getRegionCode(lat, lon));
		url.searchParams.set("time", time);

		const response = await fetch(url.toString(), {
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			this.#logger.warn(`UV Index API error: status=${response.status}`);
			return null;
		}

		const data = await readJson<UvIndexResponse>(response);

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

	#calculateFeelsLikeTemperature(temp: number, windSpeedMs: number): number {
		// Wind Chill formula requires km/h; system windSpeed is m/s
		const windSpeedKmh = windSpeedMs * 3.6;
		if (temp <= 10 && windSpeedKmh >= 1.3) {
			const v016 = windSpeedKmh ** 0.16;
			return 13.12 + 0.6215 * temp - 11.37 * v016 + 0.3965 * temp * v016;
		}

		return temp;
	}
}
