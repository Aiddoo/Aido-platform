import {
  type OAuthLinkingData,
  type OAuthLoginExchangeData,
  OAuthStateRepositoryPort,
  type NewOAuthState,
} from "#api/modules/identity/oauth-states/application/ports/oauth-state.repository.port";
import type { OAuthStateId } from "#api/modules/identity/oauth-states/domain/oauth-state-id.vo";
import {
  OAuthState,
  type OAuthStatePrimitives,
} from "#api/modules/identity/oauth-states/domain/oauth-state.aggregate";

function isAfter(left: Temporal.Instant, right: Temporal.Instant): boolean {
  return Temporal.Instant.compare(left, right) > 0;
}

export class InMemoryOAuthStateRepository extends OAuthStateRepositoryPort {
  readonly #states = new Map<number, OAuthStatePrimitives>();
  #sequence: number;
  #exchangeSequence = 0;

  constructor(states: readonly OAuthState[] = []) {
    super();
    for (const state of states) {
      this.#states.set(state.id.value, state.toPrimitives());
    }
    this.#sequence = Math.max(0, ...this.#states.keys());
  }

  get all(): readonly OAuthStatePrimitives[] {
    return [...this.#states.values()];
  }

  async create(input: NewOAuthState): Promise<void> {
    this.#sequence += 1;
    this.#states.set(this.#sequence, {
      id: this.#sequence,
      state: input.state,
      provider: input.provider,
      redirectUri: input.redirectUri,
      mode: input.mode ?? null,
      initiatingUserId: input.initiatingUserId?.value ?? null,
      exchangeCode: null,
      accessToken: null,
      refreshToken: null,
      userId: null,
      userName: null,
      profileImage: null,
      accountRestored: null,
      isNewUser: null,
      expiresAt: input.expiresAt,
      exchangedAt: null,
    });
  }

  async findByState(state: string, now: Temporal.Instant): Promise<OAuthState | null> {
    const found = this.all.find(
      (candidate) => candidate.state === state && isAfter(candidate.expiresAt, now),
    );
    return found == null ? null : OAuthState.reconstitute(found);
  }

  async findByExchangeCode(
    exchangeCode: string,
    now: Temporal.Instant,
  ): Promise<OAuthState | null> {
    const found = this.all.find(
      (candidate) =>
        candidate.exchangeCode === exchangeCode &&
        candidate.exchangedAt == null &&
        isAfter(candidate.expiresAt, now),
    );
    return found == null ? null : OAuthState.reconstitute(found);
  }

  async saveExchangeData(oauthStateId: OAuthStateId, data: OAuthLoginExchangeData): Promise<void> {
    const state = this.#states.get(oauthStateId.value);
    if (state == null) {
      return;
    }
    // Drizzle update의 set처럼 생략한 칸(undefined)은 그대로 둔다
    this.#states.set(oauthStateId.value, {
      ...state,
      exchangeCode: data.exchangeCode,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      userId: data.userId,
      userName: data.userName ?? state.userName,
      profileImage: data.profileImage ?? state.profileImage,
      accountRestored: data.accountRestored ?? state.accountRestored,
      isNewUser: data.isNewUser,
    });
  }

  async saveLinkingData(oauthStateId: OAuthStateId, data: OAuthLinkingData): Promise<void> {
    const state = this.#states.get(oauthStateId.value);
    if (state == null) {
      return;
    }
    this.#states.set(oauthStateId.value, {
      ...state,
      exchangeCode: data.exchangeCode,
      provider: data.provider,
      userId: data.providerAccountId,
    });
  }

  async save(entity: OAuthState): Promise<boolean> {
    const { exchangedAt, exchangeCode } = entity.toPrimitives();
    const state = this.#states.get(entity.id.value);
    if (
      state == null ||
      exchangedAt == null ||
      state.exchangeCode !== exchangeCode ||
      state.exchangedAt != null ||
      !isAfter(state.expiresAt, exchangedAt)
    ) {
      return false;
    }
    this.#states.set(entity.id.value, {
      ...state,
      exchangedAt,
      accessToken: null,
      refreshToken: null,
    });
    return true;
  }

  generateExchangeCode(): string {
    this.#exchangeSequence += 1;
    return `exchange-code-${this.#exchangeSequence}`;
  }

  async deleteExpiredBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const expired = this.all.filter((state) => isAfter(cutoff, state.expiresAt)).slice(0, limit);
    for (const state of expired) {
      this.#states.delete(state.id);
    }
    return expired.length;
  }
}
