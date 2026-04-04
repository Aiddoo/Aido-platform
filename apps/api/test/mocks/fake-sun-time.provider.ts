import type {
	SunTime,
	SunTimeProvider,
} from "@/modules/weather/providers/sun/sun-time.types";

/**
 * 테스트용 FakeSunTimeProvider
 *
 * 실제 KASI(한국천문연구원) API를 호출하지 않고, 고정된 일출/일몰 데이터를 반환합니다.
 */
export class FakeSunTimeProvider implements SunTimeProvider {
	private _calls: Array<{ lat: number; lon: number; date: Date }> = [];

	async getSunTime(
		lat: number,
		lon: number,
		date: Date,
	): Promise<SunTime | null> {
		this._calls.push({ lat, lon, date });
		return { sunrise: "06:15", sunset: "18:45" };
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
