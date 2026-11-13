import { Injectable } from "@nestjs/common";

import type { Coordinate } from "../../../shared/domain/coordinate.vo.js";
import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import { assertKoreanWeatherCovered } from "../../../shared/domain/korean-weather-coverage.domain-service.js";
import type { WeatherGridResolverPort } from "../../application/ports/weather-grid-resolver.port.js";

// 기상청 단기예보 격자의 Lambert 정각원추 투영 상수(https://www.data.go.kr/data/15084084/openapi.do)
const KMA_LAMBERT_GRID = {
  EARTH_RADIUS_KM: 6371.00877,
  GRID_SPACING_KM: 5.0,
  STANDARD_LATITUDE_1_DEG: 30.0,
  STANDARD_LATITUDE_2_DEG: 60.0,
  ORIGIN_LONGITUDE_DEG: 126.0,
  ORIGIN_LATITUDE_DEG: 38.0,
  ORIGIN_X: 43,
  ORIGIN_Y: 136,
} as const;

const DEG_TO_RAD = Math.PI / 180.0;

export function toKmaGrid(latitude: number, longitude: number): { nx: number; ny: number } {
  const re = KMA_LAMBERT_GRID.EARTH_RADIUS_KM / KMA_LAMBERT_GRID.GRID_SPACING_KM;
  const slat1 = KMA_LAMBERT_GRID.STANDARD_LATITUDE_1_DEG * DEG_TO_RAD;
  const slat2 = KMA_LAMBERT_GRID.STANDARD_LATITUDE_2_DEG * DEG_TO_RAD;
  const olon = KMA_LAMBERT_GRID.ORIGIN_LONGITUDE_DEG * DEG_TO_RAD;
  const olat = KMA_LAMBERT_GRID.ORIGIN_LATITUDE_DEG * DEG_TO_RAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (sf ** sn * Math.cos(slat1)) / sn;

  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / ro ** sn;

  let ra = Math.tan(Math.PI * 0.25 + latitude * DEG_TO_RAD * 0.5);
  ra = (re * sf) / ra ** sn;

  let theta = longitude * DEG_TO_RAD - olon;
  if (theta > Math.PI) {
    theta -= 2.0 * Math.PI;
  }
  if (theta < -Math.PI) {
    theta += 2.0 * Math.PI;
  }
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + KMA_LAMBERT_GRID.ORIGIN_X + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + KMA_LAMBERT_GRID.ORIGIN_Y + 0.5);

  return { nx, ny };
}

@Injectable()
export class KmaWeatherGridResolverAdapter implements WeatherGridResolverPort {
  resolveGrid(coordinate: Coordinate): GridCoordinate {
    assertKoreanWeatherCovered(coordinate);
    const { nx, ny } = toKmaGrid(coordinate.latitude, coordinate.longitude);
    return GridCoordinate.create(nx, ny);
  }
}
