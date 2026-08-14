import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

import { convertToGrid } from "../services/lambert-projection";
import { GridCoordinate } from "./grid-coordinate.vo";

/** 한국 좌표 범위 (기상청 격자 유효 범위) */
const LATITUDE_RANGE = { min: 33.0, max: 39.0 } as const;
const LONGITUDE_RANGE = { min: 124.0, max: 132.0 } as const;

/**
 * WGS84 위경도 값 객체.
 *
 * 한국 좌표 범위 불변식을 강제하고, 기상청 격자로의 변환(toGrid)을 소유한다.
 */
export class Coordinate {
	private constructor(
		private readonly _latitude: number,
		private readonly _longitude: number,
	) {}

	static of(latitude: number, longitude: number): Coordinate {
		if (latitude < LATITUDE_RANGE.min || latitude > LATITUDE_RANGE.max) {
			throw new DomainException(ErrorCode.SYS_0002, {
				field: "latitude",
				value: latitude,
			});
		}
		if (longitude < LONGITUDE_RANGE.min || longitude > LONGITUDE_RANGE.max) {
			throw new DomainException(ErrorCode.SYS_0002, {
				field: "longitude",
				value: longitude,
			});
		}
		return new Coordinate(latitude, longitude);
	}

	get latitude(): number {
		return this._latitude;
	}

	get longitude(): number {
		return this._longitude;
	}

	/** 기상청 격자 좌표로 변환한다 (Lambert 투영). */
	toGrid(): GridCoordinate {
		const { nx, ny } = convertToGrid(this._latitude, this._longitude);
		return GridCoordinate.of(nx, ny);
	}
}
