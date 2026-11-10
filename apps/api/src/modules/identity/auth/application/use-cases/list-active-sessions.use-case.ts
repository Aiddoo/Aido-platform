import type { SessionInfo } from "@aido/api/contracts/auth";

import { toISOString } from "#api/shared/domain/date/utils/format";

import type { AuthSessionRepositoryPort } from "../ports/auth-persistence.port.js";

export interface ListActiveSessionsQuery {
  readonly userId: string;
}

interface ListActiveSessionsDependencies {
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "findActiveByUserId">;
}

export class ListActiveSessionsUseCase {
  readonly #dependencies: ListActiveSessionsDependencies;

  constructor(dependencies: ListActiveSessionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ListActiveSessionsQuery): Promise<SessionInfo[]> {
    const sessions = await this.#dependencies.sessionRepository.findActiveByUserId(input.userId);
    return sessions.map((session) => ({
      id: session.id,
      deviceName: null,
      deviceType: null,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastActiveAt: toISOString(session.lastUsedAt),
      createdAt: toISOString(session.createdAt),
      isCurrent: false,
    }));
  }
}
