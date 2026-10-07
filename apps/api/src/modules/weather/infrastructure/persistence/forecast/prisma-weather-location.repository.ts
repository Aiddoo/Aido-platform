import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type { WeatherLocationRepositoryPort } from "../../../application/ports/forecast/weather-location.repository.port.js";
import { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";

@Injectable()
export class PrismaWeatherLocationRepository implements WeatherLocationRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findByUserId(userId: string): Promise<UserLocation | null> {
    const row = decodeRecord(
      "UserLocation",
      await this.client.orm.public.UserLocation.where({ userId })
        .select("userId", "latitude", "longitude", "gridX", "gridY")
        .first(),
    );
    return row === null ? null : UserLocation.reconstitute(row);
  }

  async upsert(location: UserLocation): Promise<UserLocation> {
    const data = {
      latitude: location.latitude,
      longitude: location.longitude,
      gridX: location.gridX,
      gridY: location.gridY,
    };
    const row = decodeRecord(
      "UserLocation",
      await this.client.orm.public.UserLocation.select(
        "userId",
        "latitude",
        "longitude",
        "gridX",
        "gridY",
      ).upsert({
        conflictOn: encodePatch("UserLocation", { userId: location.userId }),
        create: encodeCreate("UserLocation", { userId: location.userId, ...data }),
        update: encodePatch("UserLocation", data),
      }),
    );
    return UserLocation.reconstitute(row);
  }
}
