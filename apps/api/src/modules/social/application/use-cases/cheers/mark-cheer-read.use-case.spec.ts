import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { createCheerRepositoryMock } from "#test/mocks/ports/cheer.mock";

import { Cheer } from "../../../domain/aggregates/cheers/cheer.aggregate.js";
import { type CheerRepositoryPort } from "../../ports/cheers/cheer.repository.port.js";
import { MarkCheerRead } from "./mark-cheer-read.use-case.js";

const RECEIVER = "u-receiver";
const SENDER = "u-sender";
const CHEER_ID = 42;

const cheer = (receiverId: string, readAt: Date | null): Cheer =>
  Cheer.reconstitute({
    id: CHEER_ID,
    senderId: SENDER,
    receiverId,
    message: "화이팅!",
    readAt,
    createdAt: new Date(),
  });

describe("MarkCheerRead — 응원 읽음 처리", () => {
  let useCase: MarkCheerRead;
  let repo: Mocked<CheerRepositoryPort>;

  beforeEach(async () => {
    const markCheerReadDependencies = mockDeep<ConstructorParameters<typeof MarkCheerRead>[0]>({
      cheerRepository: createCheerRepositoryMock(),
    });
    const unit = new MarkCheerRead(markCheerReadDependencies);
    useCase = unit;
    repo = markCheerReadDependencies.cheerRepository;
  });

  it("응원이 존재하지 않으면 CHEER_1205, 읽음 처리하지 않는다", async () => {
    // Given
    repo.findById.mockResolvedValue(null);

    // When / Then
    await expect(useCase.execute({ userId: RECEIVER, cheerId: CHEER_ID })).rejects.toMatchObject({
      errorCode: "CHEER_1205",
    });
    expect(repo.markAsRead).not.toHaveBeenCalled();
  });

  it("수신자가 아니면 CHEER_1205 (소유권 검증)", async () => {
    // Given: 다른 사용자가 받은 응원
    repo.findById.mockResolvedValue(cheer("someone-else", null));

    // When / Then
    await expect(useCase.execute({ userId: RECEIVER, cheerId: CHEER_ID })).rejects.toMatchObject({
      errorCode: "CHEER_1205",
    });
    expect(repo.markAsRead).not.toHaveBeenCalled();
  });

  it("이미 읽은 응원이면 no-op (markAsRead 미호출)", async () => {
    // Given
    repo.findById.mockResolvedValue(cheer(RECEIVER, new Date()));

    // When
    await useCase.execute({ userId: RECEIVER, cheerId: CHEER_ID });

    // Then
    expect(repo.markAsRead).not.toHaveBeenCalled();
  });

  it("미읽음 응원이면 읽음 처리한다", async () => {
    // Given
    repo.findById.mockResolvedValue(cheer(RECEIVER, null));

    // When
    await useCase.execute({ userId: RECEIVER, cheerId: CHEER_ID });

    // Then
    expect(repo.markAsRead).toHaveBeenCalledWith(CHEER_ID);
  });
});
