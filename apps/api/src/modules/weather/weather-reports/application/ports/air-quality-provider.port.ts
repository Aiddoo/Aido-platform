import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";

export interface AirQuality {
  readonly pm10: number | null;
  readonly pm25: number | null;
}

/** 칸 중심에서 가장 가까운 측정소의 실시간 대기질. */
export abstract class AirQualityProviderPort {
  /** 측정소나 측정값이 없으면 null이다. 공급자 호출이 실패하면 예외로 알린다. */
  abstract findAirQuality(cell: GeoCell): Promise<AirQuality | null>;
}
