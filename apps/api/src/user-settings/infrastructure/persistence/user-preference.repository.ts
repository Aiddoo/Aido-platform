import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";

import {
  decodeRecord,
  encodeCreate,
  encodePatch,
} from "#api/shared/infrastructure/database/database-records";
import { varchar } from "#api/shared/infrastructure/database/database-values";
import type {
  TimeFormat,
  UserPreference,
} from "#api/shared/infrastructure/database/database.types";
import { requireRecord } from "#api/shared/infrastructure/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/shared/infrastructure/database/prisma8-transactional.adapter";

import type { UserPreferenceRepositoryPort } from "../../application/ports/user-preference.repository.port.js";

export interface UpdatePreferenceData {
  pushEnabled?: boolean;
  nightPushEnabled?: boolean;
  timezone?: string;
  morningReminderHour?: number;
  morningReminderMinute?: number;
  eveningReminderHour?: number;
  eveningReminderMinute?: number;
  timeFormat?: TimeFormat;
  weatherMorningEnabled?: boolean;
  weatherMorningHour?: number;
  weatherMorningMinute?: number;
  weatherEveningEnabled?: boolean;
  weatherEveningHour?: number;
  weatherEveningMinute?: number;
}

@Injectable()
export class UserPreferenceRepository implements UserPreferenceRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) */
  private get client() {
    return this.txHost.tx;
  }

  async findByUserId(userId: string): Promise<UserPreference | null> {
    return this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId))
      .first()
      .then((row) => decodeRecord("UserPreference", row));
  }

  async create(userId: string, data?: Partial<UpdatePreferenceData>): Promise<UserPreference> {
    return this.client.orm.public.UserPreference.create(
      encodeCreate("UserPreference", {
        userId,
        pushEnabled: data?.pushEnabled ?? true,
        nightPushEnabled: data?.nightPushEnabled ?? true,
        ...(data?.timezone !== undefined && { timezone: data.timezone }),
        ...(data?.morningReminderHour !== undefined && {
          morningReminderHour: data.morningReminderHour,
        }),
        ...(data?.morningReminderMinute !== undefined && {
          morningReminderMinute: data.morningReminderMinute,
        }),
        ...(data?.eveningReminderHour !== undefined && {
          eveningReminderHour: data.eveningReminderHour,
        }),
        ...(data?.eveningReminderMinute !== undefined && {
          eveningReminderMinute: data.eveningReminderMinute,
        }),
        ...(data?.timeFormat !== undefined && {
          timeFormat: data.timeFormat,
        }),
      }),
    ).then((row) => decodeRecord("UserPreference", row));
  }

  async upsert(userId: string, data: UpdatePreferenceData): Promise<UserPreference> {
    return this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId))
      .upsert({
        conflictOn: encodePatch("UserPreference", { userId }),
        create: encodeCreate("UserPreference", {
          userId,
          pushEnabled: data.pushEnabled ?? true,
          nightPushEnabled: data.nightPushEnabled ?? true,
          ...(data.timezone !== undefined && { timezone: data.timezone }),
          ...(data.morningReminderHour !== undefined && {
            morningReminderHour: data.morningReminderHour,
          }),
          ...(data.morningReminderMinute !== undefined && {
            morningReminderMinute: data.morningReminderMinute,
          }),
          ...(data.eveningReminderHour !== undefined && {
            eveningReminderHour: data.eveningReminderHour,
          }),
          ...(data.eveningReminderMinute !== undefined && {
            eveningReminderMinute: data.eveningReminderMinute,
          }),
          ...(data.timeFormat !== undefined && {
            timeFormat: data.timeFormat,
          }),
        }),
        update: encodePatch("UserPreference", this.buildUpdatePayload(data)),
      })
      .then((row) => decodeRecord("UserPreference", row));
  }

  async update(userId: string, data: UpdatePreferenceData): Promise<UserPreference> {
    return this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId))
      .update(encodePatch("UserPreference", this.buildUpdatePayload(data)))
      .then((row) => decodeRecord("UserPreference", requireRecord(row)));
  }

  private buildUpdatePayload(data: UpdatePreferenceData) {
    return {
      ...(data.pushEnabled !== undefined && {
        pushEnabled: data.pushEnabled,
      }),
      ...(data.nightPushEnabled !== undefined && {
        nightPushEnabled: data.nightPushEnabled,
      }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
      ...(data.morningReminderHour !== undefined && {
        morningReminderHour: data.morningReminderHour,
      }),
      ...(data.morningReminderMinute !== undefined && {
        morningReminderMinute: data.morningReminderMinute,
      }),
      ...(data.eveningReminderHour !== undefined && {
        eveningReminderHour: data.eveningReminderHour,
      }),
      ...(data.eveningReminderMinute !== undefined && {
        eveningReminderMinute: data.eveningReminderMinute,
      }),
      ...(data.timeFormat !== undefined && {
        timeFormat: data.timeFormat,
      }),
      ...(data.weatherMorningEnabled !== undefined && {
        weatherMorningEnabled: data.weatherMorningEnabled,
      }),
      ...(data.weatherMorningHour !== undefined && {
        weatherMorningHour: data.weatherMorningHour,
      }),
      ...(data.weatherMorningMinute !== undefined && {
        weatherMorningMinute: data.weatherMorningMinute,
      }),
      ...(data.weatherEveningEnabled !== undefined && {
        weatherEveningEnabled: data.weatherEveningEnabled,
      }),
      ...(data.weatherEveningHour !== undefined && {
        weatherEveningHour: data.weatherEveningHour,
      }),
      ...(data.weatherEveningMinute !== undefined && {
        weatherEveningMinute: data.weatherEveningMinute,
      }),
    };
  }

  /**
   * 여러 사용자의 푸시 설정 배치 조회 (N+1 방지용)
   */
  async findByUserIds(userIds: string[]): Promise<UserPreference[]> {
    if (userIds.length === 0) return [];
    return this.client.orm.public.UserPreference.where((row) => row.userId.in(userIds))
      .all()
      .then((row) => decodeRecord("UserPreference", row));
  }

  /**
   * 스트릭 필드 업데이트
   */
  async updateStreak(
    userId: string,
    data: {
      currentStreak: number;
      longestStreak: number;
      lastCompletedDate: Date | null;
    },
  ): Promise<void> {
    decodeRecord(
      "UserPreference",
      requireRecord(
        await this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId)).update(
          encodePatch("UserPreference", {
            currentStreak: data.currentStreak,
            longestStreak: data.longestStreak,
            lastCompletedDate: data.lastCompletedDate,
          }),
        ),
      ),
    );
  }

  /**
   * 사용자 타임존 upsert (없으면 생성, 있으면 갱신)
   */
  async upsertTimezone(userId: string, timezone: string): Promise<void> {
    decodeRecord(
      "UserPreference",
      await this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId)).upsert({
        conflictOn: encodePatch("UserPreference", { userId }),
        create: encodeCreate("UserPreference", { userId, timezone }),
        update: encodePatch("UserPreference", { timezone }),
      }),
    );
  }

  /**
   * 저장된 타임존이 다를 때만 갱신 (자가치유 핫패스용).
   *
   * updateMany는 매칭 0행이면 no-op — 값이 같거나 설정 행이 없으면 쓰기가 발생하지 않는다.
   * 갱신된 행 수를 반환해 호출자가 캐시 무효화 여부를 결정한다.
   */
  async refreshTimezoneIfChanged(userId: string, timezone: string): Promise<number> {
    const result = {
      count: await this.client.orm.public.UserPreference.where((row) =>
        and(row.userId.eq(userId), row.timezone.neq(varchar(timezone, 50))),
      ).updateAndCount(encodePatch("UserPreference", { timezone })),
    };
    return result.count;
  }

  /**
   * 사용자 푸시 언어 upsert (없으면 생성, 있으면 갱신) — 토큰 등록 시 Accept-Language 동기화
   */
  async upsertLocale(userId: string, locale: string): Promise<void> {
    decodeRecord(
      "UserPreference",
      await this.client.orm.public.UserPreference.where((row) => row.userId.eq(userId)).upsert({
        conflictOn: encodePatch("UserPreference", { userId }),
        create: encodeCreate("UserPreference", { userId, locale }),
        update: encodePatch("UserPreference", { locale }),
      }),
    );
  }
}
