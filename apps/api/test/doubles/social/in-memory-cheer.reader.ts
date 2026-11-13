import {
  CheerReaderPort,
  type ListCheersParams,
} from "#api/modules/social/cheers/application/ports/cheer.reader.port";
import type {
  CheerReadModel,
  CheerUserReadModel,
} from "#api/modules/social/cheers/application/read-models/cheer.read-model";
import type { Cheer } from "#api/modules/social/cheers/domain/cheer.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InMemoryCheerRepository } from "./in-memory-cheer.repository.js";

// Drizzle 조회와 같은 순서(생성 시각·id 내림차순)로 나열한다
function compareListOrder(left: Cheer, right: Cheer): number {
  return (
    Temporal.Instant.compare(right.createdAt, left.createdAt) || right.id.value - left.id.value
  );
}

// 같은 저장소 상태를 읽는다. 차단 관계는 다루지 않는다. 차단 제외는 실제 PostgreSQL integration에서 본다
export class InMemoryCheerReader extends CheerReaderPort {
  readonly #cheerRepository: InMemoryCheerRepository;
  readonly #users = new Map<string, CheerUserReadModel>();

  constructor(cheerRepository: InMemoryCheerRepository) {
    super();
    this.#cheerRepository = cheerRepository;
  }

  addUser(user: CheerUserReadModel): void {
    this.#users.set(user.id, user);
  }

  async listReceived(params: ListCheersParams): Promise<CheerReadModel[]> {
    return this.#listOwned(params, (cheer) => cheer.receiverId.equals(params.userId));
  }

  async listSent(params: ListCheersParams): Promise<CheerReadModel[]> {
    return this.#listOwned(params, (cheer) => cheer.senderId.equals(params.userId));
  }

  async countReceived(userId: UserId): Promise<number> {
    return this.#cheerRepository.listAll().filter((cheer) => cheer.receiverId.equals(userId))
      .length;
  }

  async countSent(userId: UserId): Promise<number> {
    return this.#cheerRepository.listAll().filter((cheer) => cheer.senderId.equals(userId)).length;
  }

  async countUnreadReceived(userId: UserId): Promise<number> {
    return this.#cheerRepository
      .listAll()
      .filter((cheer) => cheer.receiverId.equals(userId) && cheer.readAt == null).length;
  }

  #listOwned(params: ListCheersParams, isOwned: (cheer: Cheer) => boolean): CheerReadModel[] {
    const cheers = this.#cheerRepository.listAll();
    const anchor =
      params.afterCheerId == null
        ? null
        : cheers.find((cheer) => cheer.id.value === params.afterCheerId?.value);
    if (params.afterCheerId != null && anchor == null) {
      return [];
    }
    return cheers
      .filter(isOwned)
      .filter((cheer) => anchor == null || compareListOrder(anchor, cheer) < 0)
      .toSorted(compareListOrder)
      .slice(0, params.limit)
      .map((cheer) => this.#toReadModel(cheer));
  }

  #toReadModel(cheer: Cheer): CheerReadModel {
    const primitives = cheer.toPrimitives();
    return {
      ...primitives,
      sender: this.#userReadModel(primitives.senderId),
      receiver: this.#userReadModel(primitives.receiverId),
    };
  }

  #userReadModel(userId: string): CheerUserReadModel {
    return (
      this.#users.get(userId) ?? { id: userId, userTag: userId, name: null, profileImage: null }
    );
  }
}
