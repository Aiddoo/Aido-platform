import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { userLocation } from "#api/platform/database/schema/weather.schema";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserLocationRepositoryPort } from "../../application/ports/user-location.repository.port.js";
import type { UserLocation } from "../../domain/user-location.entity.js";
import { toUserLocation, toUserLocationRow } from "./user-location-row.mapper.js";

@Injectable()
export class DrizzleUserLocationRepository implements UserLocationRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByUserId(userId: UserId): Promise<UserLocation | null> {
    const row = await this.#db.query.userLocation.findFirst({
      columns: {
        userId: true,
        latitude: true,
        longitude: true,
        gridX: true,
        gridY: true,
        timezone: true,
        updatedAt: true,
      },
      where: { userId: userId.value },
    });
    return row == null ? null : toUserLocation(row);
  }

  async save(location: UserLocation): Promise<void> {
    const { userId, ...fields } = toUserLocationRow(location);
    await this.#db
      .insert(userLocation)
      .values({ userId, ...fields })
      .onConflictDoUpdate({ target: userLocation.userId, set: fields });
  }
}
