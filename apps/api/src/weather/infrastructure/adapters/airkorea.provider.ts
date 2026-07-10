import { Injectable, Logger } from "@nestjs/common";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { readJson } from "@/shared/infrastructure/http/read-json";
import type {
	AirQuality,
	AirQualityProvider,
} from "../../application/ports/air-quality-provider.port";
import { convertToTm } from "./wgs84-to-utmk";

interface NearbyStationResponse {
	response?: {
		body?: {
			items?: Array<{
				stationName?: string;
			}>;
		};
	};
}

interface AirQualityResponse {
	response?: {
		body?: {
			items?: Array<{
				pm10Value?: string;
				pm25Value?: string;
			}>;
		};
	};
}

@Injectable()
export class AirkoreaProvider implements AirQualityProvider {
	readonly #logger = new Logger(AirkoreaProvider.name);

	constructor(private readonly configService: TypedConfigService) {}

	async getAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
		try {
			const apiKey = this.configService.dataGoKrApiKey;
			if (!apiKey) {
				this.#logger.warn("KMA_API_KEY is not configured");
				return null;
			}

			const stationName = await this.#findNearestStation(apiKey, lat, lon);
			if (!stationName) {
				return null;
			}

			return await this.#fetchAirQuality(apiKey, stationName);
		} catch (error) {
			this.#logger.warn(
				`Failed to get air quality: ${error instanceof Error ? error.message : String(error)}`,
			);
			return null;
		}
	}

	async #findNearestStation(
		apiKey: string,
		lat: number,
		lon: number,
	): Promise<string | null> {
		const { tmX, tmY } = convertToTm(lat, lon);

		const url = new URL(
			"https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList",
		);
		url.searchParams.set("serviceKey", apiKey);
		url.searchParams.set("returnType", "json");
		url.searchParams.set("tmX", String(tmX));
		url.searchParams.set("tmY", String(tmY));
		url.searchParams.set("ver", "1.1");

		const response = await fetch(url.toString(), {
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			this.#logger.warn(`Nearby station API error: status=${response.status}`);
			return null;
		}

		const data = await readJson<NearbyStationResponse>(response);

		const items = data?.response?.body?.items;
		if (!items || items.length === 0) {
			this.#logger.warn("Nearby station API: no items in response");
			return null;
		}

		const firstItem = items[0];
		if (!firstItem) {
			return null;
		}

		const stationName = firstItem.stationName;
		if (!stationName) {
			this.#logger.warn("Nearby station API: stationName is empty");
			return null;
		}

		return stationName;
	}

	async #fetchAirQuality(
		apiKey: string,
		stationName: string,
	): Promise<AirQuality | null> {
		const url = new URL(
			"https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty",
		);
		url.searchParams.set("serviceKey", apiKey);
		url.searchParams.set("returnType", "json");
		url.searchParams.set("stationName", stationName);
		url.searchParams.set("dataTerm", "DAILY");
		url.searchParams.set("ver", "1.5");

		const response = await fetch(url.toString(), {
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			this.#logger.warn(`Air quality API error: status=${response.status}`);
			return null;
		}

		const data = await readJson<AirQualityResponse>(response);

		const items = data?.response?.body?.items;
		if (!items || items.length === 0) {
			this.#logger.warn("Air quality API: no items in response");
			return null;
		}

		const firstItem = items[0];
		if (!firstItem) {
			return null;
		}

		return {
			pm10: this.#parseValue(firstItem.pm10Value),
			pm25: this.#parseValue(firstItem.pm25Value),
		};
	}

	#parseValue(value: string | undefined): number | null {
		if (
			value === undefined ||
			value === null ||
			value === "" ||
			value === "-"
		) {
			return null;
		}

		const parsed = Number(value);
		if (Number.isNaN(parsed)) {
			return null;
		}

		return parsed;
	}
}
