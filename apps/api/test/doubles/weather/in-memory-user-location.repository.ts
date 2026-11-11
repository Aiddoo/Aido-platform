import { UserLocationRepositoryPort } from "#api/modules/weather/locations/application/ports/user-location.repository.port";
import { UserLocation } from "#api/modules/weather/locations/domain/user-location.entity";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 저장 사본을 두어 save 없이 바꾼 Entity가 저장소 상태로 새지 않게 한다
function copyOf(location: UserLocation): UserLocation {
  return UserLocation.reconstitute(location.toPrimitives());
}

export class InMemoryUserLocationRepository extends UserLocationRepositoryPort {
  readonly #locations = new Map<string, UserLocation>();
  readonly saved: UserLocation[] = [];
  readonly reads: string[] = [];

  constructor(locations: readonly UserLocation[] = []) {
    super();
    for (const location of locations) {
      this.#locations.set(location.userId.value, copyOf(location));
    }
  }

  clear(): void {
    this.#locations.clear();
  }

  set(location: UserLocation): void {
    this.#locations.set(location.userId.value, copyOf(location));
  }

  async findByUserId(userId: UserId): Promise<UserLocation | null> {
    this.reads.push(userId.value);
    const found = this.#locations.get(userId.value);
    return found == null ? null : copyOf(found);
  }

  async save(location: UserLocation): Promise<void> {
    this.saved.push(copyOf(location));
    this.#locations.set(location.userId.value, copyOf(location));
  }
}
