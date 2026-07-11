/**
 * 기상청 격자 좌표 값 객체 (Lambert 투영 결과, gridX/gridY).
 */
export class GridCoordinate {
	private constructor(
		private readonly _gridX: number,
		private readonly _gridY: number,
	) {}

	static of(gridX: number, gridY: number): GridCoordinate {
		return new GridCoordinate(gridX, gridY);
	}

	get gridX(): number {
		return this._gridX;
	}

	get gridY(): number {
		return this._gridY;
	}

	equals(other: GridCoordinate): boolean {
		return this._gridX === other._gridX && this._gridY === other._gridY;
	}
}
