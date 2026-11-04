import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import {
  USER_ACTIVITY_READER,
  type UserActivityReaderPort,
} from "#api/modules/identity/identity-user-access.public";

import type { TodoSeriesOwnerPort } from "../../../application/ports/series/todo-series-owner.port.js";
import type { SeriesOwnerActivity } from "../../../domain/policies/series/series-dormancy.policy.js";

@Injectable()
export class TodoSeriesOwnerAdapter implements TodoSeriesOwnerPort {
  constructor(
    @Inject(USER_ACTIVITY_READER) private readonly activityReader: UserActivityReaderPort,
    @Inject(ENTITLEMENT_READER) private readonly entitlementReader: EntitlementReaderPort,
  ) {}

  async findOperatingOwners(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, SeriesOwnerActivity>> {
    const accounts = await this.activityReader.findActiveAccounts(userIds);
    return new Map(accounts.map((account) => [account.userId, account]));
  }

  async hasPaidAccess(userId: string): Promise<boolean> {
    const snapshot = await this.entitlementReader.getAccessSnapshot(userId);
    return snapshot.isPremium;
  }
}
