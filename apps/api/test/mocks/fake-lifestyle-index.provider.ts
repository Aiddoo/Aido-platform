import type {
	LifestyleIndex,
	LifestyleIndexProvider,
} from "@/weather/application/ports/lifestyle-index-provider.port";

/**
 * 테스트용 FakeLifestyleIndexProvider
 *
 * 실제 기상청 생활기상지수 API를 호출하지 않고, 고정된 데이터를 반환합니다.
 */
export class FakeLifestyleIndexProvider implements LifestyleIndexProvider {
	private _calls: Array<{
		lat: number;
		lon: number;
		date: Date;
		currentTemp: number;
		windSpeed: number;
	}> = [];

	async getIndex(
		lat: number,
		lon: number,
		date: Date,
		currentTemp: number,
		windSpeed: number,
	): Promise<LifestyleIndex> {
		this._calls.push({ lat, lon, date, currentTemp, windSpeed });
		return { feelsLikeTemperature: 12, uvIndex: 5 };
	}

	getCalls(): Array<{
		lat: number;
		lon: number;
		date: Date;
		currentTemp: number;
		windSpeed: number;
	}> {
		return [...this._calls];
	}

	getCallCount(): number {
		return this._calls.length;
	}

	clear(): void {
		this._calls = [];
	}
}
