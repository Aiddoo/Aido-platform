import { describeUserLocationRepositoryContract } from "#test/contracts/weather/user-location-repository.contract";
import { InMemoryUserLocationRepository } from "#test/doubles/weather/in-memory-user-location.repository";

describe("InMemoryUserLocationRepository", () => {
  describeUserLocationRepositoryContract(async () => new InMemoryUserLocationRepository());
});
