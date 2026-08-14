import type {
	WeatherForecast,
	WeatherProvider,
} from "@/weather/application/ports/weather-provider.port";

/**
 * 테스트용 FakeWeatherProvider
 *
 * 실제 기상청(KMA) API를 호출하지 않고, 고정된 예보 데이터를 반환합니다.
 */
export class FakeWeatherProvider implements WeatherProvider {
	readonly name = "fake";
	private _calls: Array<{ lat: number; lon: number; date: Date }> = [];

	async getForecast(lat: number, lon: number, date: Date): Promise<WeatherForecast> {
		this._calls.push({ lat, lon, date });
		return {
			date,
			skyCondition: "CLEAR",
			precipitationType: "NONE",
			precipitationProbability: 10,
			temperatureMin: 8,
			temperatureMax: 20,
			humidity: 55,
			windSpeed: 3.5,
			hourlyForecasts: Array.from({ length: 24 }, (_, i) => ({
				hour: i,
				temperature: 10 + Math.round(Math.sin((i / 24) * Math.PI) * 10),
				skyCondition: "CLEAR",
				precipitationProbability: 10,
				precipitationAmount: 0,
				snowAmount: 0,
			})),
			dailyForecasts: [
				{
					date: date.toISOString().slice(0, 10),
					skyCondition: "CLEAR",
					precipitationType: "NONE",
					precipitationProbability: 10,
					temperatureMin: 8,
					temperatureMax: 20,
				},
			],
		};
	}

	isConfigured(): boolean {
		return true;
	}

	getCalls(): Array<{ lat: number; lon: number; date: Date }> {
		return [...this._calls];
	}

	getCallCount(): number {
		return this._calls.length;
	}

	clear(): void {
		this._calls = [];
	}
}
