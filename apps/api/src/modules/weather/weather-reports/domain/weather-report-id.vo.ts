import { EntityId } from "#api/shared/domain/model/entity-id";

// 리포트는 칸마다 하나라 칸 geohash가 식별자다
export class WeatherReportId extends EntityId<string> {
  static reconstitute(cellKey: string): WeatherReportId {
    return new WeatherReportId(cellKey);
  }
}
