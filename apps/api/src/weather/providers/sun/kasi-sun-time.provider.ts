import { Injectable, Logger } from "@nestjs/common";
import { toCompactDateString } from "@/shared/domain/date/utils/format";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import type { SunTime, SunTimeProvider } from "./sun-time.types";

interface SunTimeResponse {
	response?: {
		header?: {
			resultCode?: string;
		};
		body?: {
			items?: {
				item?: {
					sunrise?: string;
					sunset?: string;
				};
			};
		};
	};
}

@Injectable()
export class KasiSunTimeProvider implements SunTimeProvider {
	readonly #logger = new Logger(KasiSunTimeProvider.name);

	constructor(private readonly configService: TypedConfigService) {}

	async getSunTime(
		lat: number,
		lon: number,
		date: Date,
	): Promise<SunTime | null> {
		try {
			const apiKey = this.configService.dataGoKrApiKey;
			if (!apiKey) {
				this.#logger.warn("KMA_API_KEY is not configured");
				return null;
			}

			const locdate = toCompactDateString(date);

			const url = new URL(
				"https://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService/getLCRiseSetInfo",
			);
			url.searchParams.set("serviceKey", apiKey);
			url.searchParams.set("longitude", String(lon));
			url.searchParams.set("latitude", String(lat));
			url.searchParams.set("locdate", locdate);
			url.searchParams.set("dnYn", "Y");
			url.searchParams.set("_type", "json");

			const response = await fetch(url.toString(), {
				signal: AbortSignal.timeout(10_000),
			});

			if (!response.ok) {
				this.#logger.warn(`Sun time API error: status=${response.status}`);
				return null;
			}

			const raw: unknown = await response.json();
			const data = raw as SunTimeResponse;

			const resultCode = data?.response?.header?.resultCode;
			if (resultCode !== "00") {
				this.#logger.warn(`Sun time API error: resultCode=${resultCode}`);
				return null;
			}

			const item = data?.response?.body?.items?.item;
			if (!item) {
				this.#logger.warn("Sun time API: no item in response");
				return null;
			}

			const sunriseRaw = item.sunrise;
			const sunsetRaw = item.sunset;

			if (!sunriseRaw || !sunsetRaw) {
				this.#logger.warn("Sun time API: sunrise or sunset value is empty");
				return null;
			}

			const sunrise = this.#formatTime(sunriseRaw);
			const sunset = this.#formatTime(sunsetRaw);

			if (!sunrise || !sunset) {
				this.#logger.warn("Sun time API: failed to parse time values");
				return null;
			}

			return { sunrise, sunset };
		} catch (error) {
			this.#logger.warn(
				`Failed to get sun time: ${error instanceof Error ? error.message : String(error)}`,
			);
			return null;
		}
	}

	#formatTime(raw: string): string | null {
		const trimmed = raw.trim();
		if (trimmed.length < 4) {
			return null;
		}

		const hours = trimmed.slice(0, -2).padStart(2, "0");
		const minutes = trimmed.slice(-2);

		const hoursNum = Number(hours);
		const minutesNum = Number(minutes);

		if (
			Number.isNaN(hoursNum) ||
			Number.isNaN(minutesNum) ||
			hoursNum < 0 ||
			hoursNum > 23 ||
			minutesNum < 0 ||
			minutesNum > 59
		) {
			return null;
		}

		return `${hours}:${minutes}`;
	}
}
