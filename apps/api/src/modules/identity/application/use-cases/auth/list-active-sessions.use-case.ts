import { toISOString } from "#api/shared/domain/date/utils/format";

import type { AuthSessionRepositoryPort } from "../../ports/auth/auth-persistence.port.js";
import type { SessionInfo } from "../../types/auth/index.js";

export interface ListActiveSessionsInput {
  readonly userId: string;
}

interface ListActiveSessionsDependencies {
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "findActiveByUserId">;
}

export class ListActiveSessions {
  readonly #dependencies: ListActiveSessionsDependencies;

  constructor(dependencies: ListActiveSessionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ListActiveSessionsInput): Promise<SessionInfo[]> {
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
