import { Coordinate } from "../value-objects/coordinate.vo";
import { GridCoordinate } from "../value-objects/grid-coordinate.vo";

/**
 * 사용자 위치 애그리게잇.
 *
 * 사용자당 하나의 WGS84 좌표 + 파생된 기상청 격자를 소유한다. 좌표를 정하면
 * 격자는 결정적으로 파생되므로, 생성 시 좌표로부터 격자를 계산한다(reconstitute는
 * 저장된 격자를 그대로 복원).
 */
export class UserLocation {
	private constructor(
		private readonly _userId: string,
		private readonly _coordinate: Coordinate,
		private readonly _grid: GridCoordinate,
	) {}

	/** 좌표로부터 새 위치를 생성한다 (격자 파생). */
	static create(userId: string, coordinate: Coordinate): UserLocation {
		return new UserLocation(userId, coordinate, coordinate.toGrid());
	}

	/** 저장된 값에서 복원한다. */
	static reconstitute(props: {
		userId: string;
		latitude: number;
		longitude: number;
		gridX: number;
		gridY: number;
	}): UserLocation {
		return new UserLocation(
			props.userId,
			Coordinate.of(props.latitude, props.longitude),
			GridCoordinate.of(props.gridX, props.gridY),
		);
	}

	get userId(): string {
		return this._userId;
	}

	get coordinate(): Coordinate {
		return this._coordinate;
	}

	get grid(): GridCoordinate {
		return this._grid;
	}

	get latitude(): number {
		return this._coordinate.latitude;
	}

	get longitude(): number {
		return this._coordinate.longitude;
	}

	get gridX(): number {
		return this._grid.gridX;
	}

	get gridY(): number {
		return this._grid.gridY;
	}
}
