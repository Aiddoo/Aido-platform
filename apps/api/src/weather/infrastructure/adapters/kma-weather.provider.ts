import { Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { readJson } from "@/shared/infrastructure/http/read-json";
import type {
	WeatherForecast,
	WeatherProvider,
} from "../../application/ports/weather-provider.port";
import { getKmaBaseDateTime } from "../../domain/services/kma-base-datetime";
import { convertToGrid } from "../../domain/services/lambert-projection";
import { KMA_BASE_URL, KMA_ENDPOINTS } from "./kma.constants";
import type { KmaApiResponse } from "./kma-response-parser";
import { parseKmaResponse } from "./kma-response-parser";

@Injectable()
export class KmaWeatherProvider implements WeatherProvider {
	readonly name = "kma";
	readonly #logger = new Logger(KmaWeatherProvider.name);

	constructor(private readonly configService: TypedConfigService) {}

	async getForecast(
		lat: number,
		lon: number,
		date: Date,
	): Promise<WeatherForecast> {
		const { nx, ny } = convertToGrid(lat, lon);
		const { baseDate, baseTime } = getKmaBaseDateTime(date);

		const url = new URL(`${KMA_BASE_URL}${KMA_ENDPOINTS.VILLAGE_FORECAST}`);
		url.searchParams.set("serviceKey", this.configService.dataGoKrApiKey ?? "");
		url.searchParams.set("pageNo", "1");
		url.searchParams.set("numOfRows", "1000");
		url.searchParams.set("dataType", "JSON");
		url.searchParams.set("base_date", baseDate);
		url.searchParams.set("base_time", baseTime);
		url.searchParams.set("nx", String(nx));
		url.searchParams.set("ny", String(ny));

		const response = await fetch(url.toString(), {
			signal: AbortSignal.timeout(10_000),
		});

		if (!response.ok) {
			this.#logger.error(
				`KMA API error: status=${response.status}, url=${url.pathname}`,
			);
			throw BusinessExceptions.weatherServiceUnavailable({
				status: response.status,
			});
		}

		const data = await readJson<KmaApiResponse>(response);

		if (!data?.response?.header?.resultCode) {
			this.#logger.error("KMA API: unexpected response structure");
			throw BusinessExceptions.weatherServiceUnavailable({
				reason: "unexpected response structure",
			});
		}

		if (data.response.header.resultCode !== "00") {
			this.#logger.error(
				`KMA API error: code=${data.response.header.resultCode}, msg=${data.response.header.resultMsg}`,
			);
			throw BusinessExceptions.weatherServiceUnavailable({
				code: data.response.header.resultCode,
				message: data.response.header.resultMsg,
			});
		}

		return parseKmaResponse(data, date);
	}

	isConfigured(): boolean {
		return !!this.configService.dataGoKrApiKey;
	}
}
