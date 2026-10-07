import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type { WeatherLocationRepositoryPort } from "../../../application/ports/forecast/weather-location.repository.port.js";
import { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";

/**
 * WeatherLocationRepositoryPort의 Prisma 어댑터.
 *
 * UserLocation 애그리게잇을 Prisma UserLocation 행으로 매핑한다. 트랜잭션은 CLS로
 * 전파된다 — TransactionHost.tx가 활성 트랜잭션(없으면 베이스)을 반환.
 */
@Injectable()
export class PrismaWeatherLocationRepository implements WeatherLocationRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async findByUserId(userId: string): Promise<UserLocation | null> {
    const row = decodeRecord(
      "UserLocation",
      await this.client.orm.public.UserLocation.where((row) => row.userId.eq(userId)).first(),
    );
    return row ? UserLocation.reconstitute(row) : null;
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
      await this.client.orm.public.UserLocation.where((row) =>
        row.userId.eq(location.userId),
      ).upsert({
        conflictOn: encodePatch("UserLocation", { userId: location.userId }),
        create: encodeCreate("UserLocation", { userId: location.userId, ...data }),
        update: encodePatch("UserLocation", data),
      }),
    );
    return UserLocation.reconstitute(row);
  }
}
