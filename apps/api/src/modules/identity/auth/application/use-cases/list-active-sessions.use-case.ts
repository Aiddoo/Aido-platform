import { toISOString } from "#api/shared/domain/date/utils/format";

import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";

// 기기 이름·종류는 세션에 저장하지 않아 출시 응답에서 null이다
export interface ActiveSession {
  readonly id: string;
  readonly deviceName: null;
  readonly deviceType: null;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly lastActiveAt: string;
  readonly createdAt: string;
  readonly isCurrent: boolean;
}

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

  async execute(input: ListActiveSessionsQuery): Promise<ActiveSession[]> {
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
