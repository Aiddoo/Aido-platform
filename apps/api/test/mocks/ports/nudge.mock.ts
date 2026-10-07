import { vi, type Mocked } from "vitest";

import type { NudgeRepositoryPort } from "#api/modules/social/application/ports/nudges/nudge.repository.port";

export function createNudgeRepositoryMock(): Mocked<NudgeRepositoryPort> {
  return {
    findById: vi.fn(),
    findLastNudgeForTodo: vi.fn(),
    findLastNudgeToUser: vi.fn(),
    findLastRemindNudge: vi.fn(),
    findTargetTodo: vi.fn(),
    saveRead: vi.fn(),
    saveReply: vi.fn(),
    saveThanksBatch: vi.fn(),
    findInteractionById: vi.fn(),
    findInteractions: vi.fn(),
    findInteractionTodo: vi.fn(),
    lockInteractionTodo: vi.fn(),
    findLastReceivedNudgeId: vi.fn(),
    findThanksCandidates: vi.fn(),
    findThanksCandidatePage: vi.fn(),
    findReceivedNudges: vi.fn(),
    findSentNudges: vi.fn(),
    countTodayNudges: vi.fn(),
    countSentSince: vi.fn(),
    countTodayTodos: vi.fn(),
    countReceived: vi.fn(),
    countSent: vi.fn(),
    countUnreadReceived: vi.fn(),
    createNudge: vi.fn(),
    createRemindNudge: vi.fn(),
  };
}
