import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { requireRecord } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userLocation } from "#api/platform/database/schema/index";

import type { WeatherLocationRepositoryPort } from "../../application/ports/user-location.repository.port.js";
import { UserLocation } from "../../domain/user-location.entity.js";

const locationColumns = {
  userId: userLocation.userId,
  latitude: userLocation.latitude,
  longitude: userLocation.longitude,
  gridX: userLocation.gridX,
  gridY: userLocation.gridY,
  timezone: userLocation.timezone,
};

@Injectable()
export class DrizzleWeatherLocationRepository implements WeatherLocationRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByUserId(userId: string): Promise<UserLocation | null> {
    const row = await this.#db.query.userLocation.findFirst({
      columns: {
        userId: true,
        latitude: true,
        longitude: true,
        gridX: true,
        gridY: true,
        timezone: true,
      },
      where: { userId },
    });
    return row == null ? null : UserLocation.reconstitute(row);
  }

  async upsert(location: UserLocation): Promise<UserLocation> {
    const data = {
      latitude: location.latitude,
      longitude: location.longitude,
      gridX: location.grid?.gridX ?? null,
      gridY: location.grid?.gridY ?? null,
      timezone: location.timezone,
    };
    const [row] = await this.#db
      .insert(userLocation)
      .values({ userId: location.userId, ...data })
      .onConflictDoUpdate({ target: userLocation.userId, set: data })
      .returning(locationColumns);
    return UserLocation.reconstitute(requireRecord(row));
  }
}
