import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { isSeriesOwnerDormant } from "#api/modules/planning/planning-todo-series-dormancy.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { now } from "#api/shared/domain/date/utils/core";

import type { TodoSeriesOwnerDormancyPort } from "../../../application/ports/reminders/todo-series-owner-dormancy.port.js";

/** planning이 notification을 조립하므로 모듈 대신 순수 정책만 받아 쓴다. 활동 기록은 스케줄러 조회처럼 직접 읽는다. */
@Injectable()
export class DrizzleTodoSeriesOwnerDormancyAdapter implements TodoSeriesOwnerDormancyPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  async isOwnerDormant(userId: string): Promise<boolean> {
    const owner = await this.txHost.tx.query.user.findFirst({
      columns: { lastActiveAt: true, createdAt: true },
      where: { id: userId },
      with: { preference: { columns: { timezone: true } } },
    });
    if (owner == null) {
      return false;
    }
    return isSeriesOwnerDormant(
      {
        lastActiveAt: owner.lastActiveAt,
        signedUpAt: owner.createdAt,
        timezone: owner.preference?.timezone ?? null,
      },
      now(),
    );
  }
}
