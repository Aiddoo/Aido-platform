import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { Coordinate } from "../../shared/domain/coordinate.vo.js";
import { GridCoordinate } from "../../shared/domain/grid-coordinate.vo.js";

export interface UserLocationPrimitives {
  readonly userId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly gridX: number | null;
  readonly gridY: number | null;
  /** v2 이전에 저장된 행에서 null이다. */
  readonly timezone: string | null;
  readonly updatedAt: Temporal.Instant;
}

interface UserLocationProps {
  coordinate: Coordinate;
  grid: GridCoordinate | null;
  timezone: TimeZone | null;
  updatedAt: Temporal.Instant;
}

interface CreateUserLocationParams {
  readonly userId: UserId;
  readonly coordinate: Coordinate;
  /** KMA 지원 범위 안의 좌표에만 있다. */
  readonly grid: GridCoordinate | null;
  readonly timezone: TimeZone;
  readonly now: Temporal.Instant;
}

/** 사용자당 하나인 날씨 기준 위치. 같은 사용자의 위치는 새 위치로 통째로 바뀐다. */
export class UserLocation extends Entity<UserId, UserLocationProps> {
  static create(params: CreateUserLocationParams): UserLocation {
    return new UserLocation(params.userId, {
      coordinate: params.coordinate,
      grid: params.grid,
      timezone: params.timezone,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: UserLocationPrimitives): UserLocation {
    const { gridX, gridY } = primitives;
    return new UserLocation(UserId.reconstitute(primitives.userId), {
      coordinate: Coordinate.reconstitute(primitives.latitude, primitives.longitude),
      grid: gridX == null || gridY == null ? null : GridCoordinate.reconstitute(gridX, gridY),
      timezone: primitives.timezone == null ? null : TimeZone.reconstitute(primitives.timezone),
      updatedAt: primitives.updatedAt,
    });
  }

  get userId(): UserId {
    return this.id;
  }

  get coordinate(): Coordinate {
    return this.props.coordinate;
  }

  get grid(): GridCoordinate | null {
    return this.props.grid;
  }

  get timezone(): TimeZone | null {
    return this.props.timezone;
  }

  get latitude(): number {
    return this.props.coordinate.latitude;
  }

  get longitude(): number {
    return this.props.coordinate.longitude;
  }

  /** v1 KMA 경로는 격자 없는 해외 위치를 "위치 없음"과 같은 WEATHER_1902로 다룬다. */
  requireKmaGrid(): GridCoordinate {
    if (this.props.grid == null) {
      throw new DomainException(ErrorCode.WEATHER_1902);
    }
    return this.props.grid;
  }

  toPrimitives(): UserLocationPrimitives {
    return {
      userId: this.id.value,
      latitude: this.props.coordinate.latitude,
      longitude: this.props.coordinate.longitude,
      gridX: this.props.grid?.gridX ?? null,
      gridY: this.props.grid?.gridY ?? null,
      timezone: this.props.timezone?.value ?? null,
      updatedAt: this.props.updatedAt,
    };
  }
}
