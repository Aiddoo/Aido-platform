import type { UserLocationRepositoryPort } from "#api/modules/weather/locations/application/ports/user-location.repository.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createUserLocationFixture,
  USER_LOCATION_FIXTURE_NOW,
  USER_LOCATION_FIXTURE_OTHER_USER_ID,
  USER_LOCATION_FIXTURE_USER_ID,
} from "#test/fixtures/weather/user-location.fixture";

const USER_ID = UserId.reconstitute(USER_LOCATION_FIXTURE_USER_ID);
const OTHER_USER_ID = UserId.reconstitute(USER_LOCATION_FIXTURE_OTHER_USER_ID);
const LATER = USER_LOCATION_FIXTURE_NOW.add({ minutes: 5 });

export function describeUserLocationRepositoryContract(
  createRepository: () => Promise<UserLocationRepositoryPort>,
): void {
  describe("사용자 위치 저장소 계약", () => {
    it("저장하지 않은 사용자는 null이고 다른 사용자의 위치를 돌려주지 않는다", async () => {
      // Given
      const repository = await createRepository();
      await repository.save(createUserLocationFixture({ userId: OTHER_USER_ID.value }));

      // When
      const found = await repository.findByUserId(USER_ID);

      // Then
      expect(found).toBeNull();
    });

    it("저장한 위치를 격자·시간대·시각까지 그대로 복원한다", async () => {
      // Given
      const repository = await createRepository();
      const location = createUserLocationFixture();

      // When
      await repository.save(location);
      const found = await repository.findByUserId(USER_ID);

      // Then
      expect(found?.toPrimitives()).toEqual(location.toPrimitives());
    });

    it("해외 위치는 격자 없이 저장하고 격자 없이 복원한다", async () => {
      // Given
      const repository = await createRepository();
      const tokyo = createUserLocationFixture({
        latitude: 35.6762,
        longitude: 139.6503,
        gridX: null,
        gridY: null,
        timezone: "Asia/Tokyo",
      });

      // When
      await repository.save(tokyo);
      const found = await repository.findByUserId(USER_ID);

      // Then
      expect(found?.grid).toBeNull();
      expect(found?.toPrimitives()).toEqual(tokyo.toPrimitives());
    });

    it("같은 사용자가 다시 저장하면 위치 하나를 새 값으로 덮어쓴다", async () => {
      // Given
      const repository = await createRepository();
      await repository.save(createUserLocationFixture());
      const moved = createUserLocationFixture({
        latitude: 35.1796,
        longitude: 129.0756,
        gridX: 98,
        gridY: 76,
        updatedAt: LATER,
      });

      // When
      await repository.save(moved);
      const found = await repository.findByUserId(USER_ID);

      // Then
      expect(found?.toPrimitives()).toEqual(moved.toPrimitives());
    });

    it("v2 이전에 저장돼 시간대가 없는 위치도 시간대 null로 복원한다", async () => {
      // Given
      const repository = await createRepository();
      await repository.save(createUserLocationFixture({ timezone: null }));

      // When
      const found = await repository.findByUserId(USER_ID);

      // Then
      expect(found?.timezone).toBeNull();
    });
  });
}
