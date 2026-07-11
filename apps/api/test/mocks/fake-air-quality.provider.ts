import type {
	AirQuality,
	AirQualityProvider,
} from "@/weather/application/ports/air-quality-provider.port";

/**
 * 테스트용 FakeAirQualityProvider
 *
 * 실제 에어코리아 API를 호출하지 않고, 고정된 미세먼지 데이터를 반환합니다.
 */
export class FakeAirQualityProvider implements AirQualityProvider {
	private _calls: Array<{ lat: number; lon: number }> = [];

	async getAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
		this._calls.push({ lat, lon });
		return { pm10: 45, pm25: 22 };
	}

	getCalls(): Array<{ lat: number; lon: number }> {
		return [...this._calls];
	}

	getCallCount(): number {
		return this._calls.length;
	}

	clear(): void {
		this._calls = [];
	}
}
