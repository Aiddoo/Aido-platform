import {
  type FindPushTokensParams,
  type KeepPushTokenData,
  PushTokenRegistrationConflictError,
  PushTokenRepositoryPort,
  type RegisterPushTokenData,
} from "#api/modules/notification/push/application/ports/push-token.repository.port";
import type { PushTokenRecord } from "#api/modules/notification/push/application/read-models/push-token.read-model";
import type { PushDeviceId } from "#api/modules/notification/push/domain/push-device-id.vo";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

interface StoredPushToken extends PushTokenRecord {
  readonly sessionId: string | null;
}

function toRecord({ sessionId: _sessionId, ...record }: StoredPushToken): PushTokenRecord {
  return record;
}

// Drizzle처럼 updatedAt 내림차순으로 나열한다
function compareRecentFirst(left: StoredPushToken, right: StoredPushToken): number {
  return Temporal.Instant.compare(right.updatedAt, left.updatedAt) || right.id - left.id;
}

// (userId, deviceId)와 token이 각각 유일하다. 다른 등록이 가진 토큰을 넣으면 동시 등록 충돌로 본다
export class InMemoryPushTokenRepository extends PushTokenRepositoryPort {
  readonly #tokens = new Map<number, StoredPushToken>();
  #sequence: number;
  #conflictsLeft = 0;
  registerAttempts = 0;

  constructor(tokens: readonly (PushTokenRecord & { readonly sessionId?: string | null })[] = []) {
    super();
    for (const token of tokens) {
      this.#tokens.set(token.id, { ...token, sessionId: token.sessionId ?? null });
    }
    this.#sequence = Math.max(0, ...this.#tokens.keys());
  }

  get size(): number {
    return this.#tokens.size;
  }

  // 다음 등록 n번을 다른 트랜잭션이 먼저 같은 토큰을 가져간 것처럼 실패시킨다
  failNextRegistrations(count: number): void {
    this.#conflictsLeft = count;
  }

  tokenOf(userId: string, deviceId: string): PushTokenRecord | undefined {
    const stored = this.#find((row) => row.userId === userId && row.deviceId === deviceId);
    return stored == null ? undefined : toRecord(stored);
  }

  sessionOf(userId: string, deviceId: string): string | null | undefined {
    return this.#find((row) => row.userId === userId && row.deviceId === deviceId)?.sessionId;
  }

  async releasePushTokenHeldElsewhere(data: {
    readonly userId: UserId;
    readonly deviceId: PushDeviceId;
    readonly token: string | null;
  }): Promise<{ readonly userIds: readonly string[] }> {
    const userId = data.userId.value;
    const deviceId = data.deviceId.value;
    const released = [...this.#tokens.values()].filter((row) => {
      const sameDeviceOfOtherUser = row.deviceId === deviceId && row.userId !== userId;
      const sameTokenElsewhere =
        data.token != null &&
        row.token === data.token &&
        (row.userId !== userId || row.deviceId !== deviceId);
      return sameDeviceOfOtherUser || sameTokenElsewhere;
    });
    return { userIds: this.#delete(released) };
  }

  async registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord> {
    this.registerAttempts += 1;
    const existing = this.#find(
      (row) => row.userId === data.userId.value && row.deviceId === data.deviceId.value,
    );
    const tokenHolder = this.#find((row) => row.token === data.token);
    if (this.#conflictsLeft > 0 || (tokenHolder != null && tokenHolder !== existing)) {
      this.#conflictsLeft = Math.max(0, this.#conflictsLeft - 1);
      throw new PushTokenRegistrationConflictError();
    }
    const id = existing?.id ?? this.#sequence + 1;
    this.#sequence = Math.max(this.#sequence, id);
    const stored: StoredPushToken = {
      id,
      userId: data.userId.value,
      token: data.token,
      deviceId: data.deviceId.value,
      platform: data.platform,
      sessionId: data.sessionId,
      isActive: true,
      payloadVersion: data.payloadVersion,
      appVersion: data.appVersion,
      createdAt: existing?.createdAt ?? data.registeredAt,
      updatedAt: data.registeredAt,
      lastUsedAt: existing?.lastUsedAt ?? data.registeredAt,
    };
    this.#tokens.set(id, stored);
    return toRecord(stored);
  }

  async keepPushToken(data: KeepPushTokenData): Promise<{ readonly hasActiveToken: boolean }> {
    const existing = this.#find(
      (row) => row.userId === data.userId.value && row.deviceId === data.deviceId.value,
    );
    if (existing == null) {
      return { hasActiveToken: false };
    }
    this.#tokens.set(existing.id, {
      ...existing,
      sessionId: data.sessionId,
      payloadVersion: data.payloadVersion,
      appVersion: data.appVersion,
      updatedAt: data.keptAt,
    });
    return { hasActiveToken: existing.isActive };
  }

  async findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenRecord[]> {
    return [...this.#tokens.values()]
      .filter((row) => row.userId === params.userId.value && (!params.activeOnly || row.isActive))
      .toSorted(compareRecentFirst)
      .map(toRecord);
  }

  async findActivePushTokensByUsers(users: readonly UserId[]): Promise<PushTokenRecord[]> {
    const userIds = users.map((user) => user.value);
    return [...this.#tokens.values()]
      .filter((row) => userIds.includes(row.userId) && row.isActive)
      .map(toRecord);
  }

  async deletePushTokensByDevice(
    userId: UserId,
    deviceId: PushDeviceId,
  ): Promise<{ count: number }> {
    const deleted = [...this.#tokens.values()].filter(
      (row) => row.userId === userId.value && row.deviceId === deviceId.value,
    );
    return { count: this.#delete(deleted).length };
  }

  async deleteAllPushTokensByUser(userId: UserId): Promise<{ count: number }> {
    const deleted = [...this.#tokens.values()].filter((row) => row.userId === userId.value);
    return { count: this.#delete(deleted).length };
  }

  async deletePushTokenByDeviceAndToken(data: {
    readonly deviceId: PushDeviceId;
    readonly token: string;
  }): Promise<{ readonly userIds: readonly string[] }> {
    const deleted = [...this.#tokens.values()].filter(
      (row) => row.token === data.token && row.deviceId === data.deviceId.value,
    );
    return { userIds: this.#delete(deleted) };
  }

  async deletePushTokensBySessions(
    sessionIds: readonly string[],
  ): Promise<{ readonly userIds: readonly string[] }> {
    const deleted = [...this.#tokens.values()].filter(
      (row) => row.sessionId != null && sessionIds.includes(row.sessionId),
    );
    return { userIds: this.#delete(deleted) };
  }

  async deactivateInvalidTokens(
    tokens: string[],
    deactivatedAt: Temporal.Instant,
  ): Promise<{ count: number }> {
    const targets = [...this.#tokens.values()].filter((row) => tokens.includes(row.token));
    for (const row of targets) {
      this.#tokens.set(row.id, { ...row, isActive: false, updatedAt: deactivatedAt });
    }
    return { count: targets.length };
  }

  #find(predicate: (row: StoredPushToken) => boolean): StoredPushToken | undefined {
    return [...this.#tokens.values()].find(predicate);
  }

  #delete(rows: readonly StoredPushToken[]): string[] {
    for (const row of rows) {
      this.#tokens.delete(row.id);
    }
    return rows.map((row) => row.userId);
  }
}
