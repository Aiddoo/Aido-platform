import { describePushDeviceRepositoryContract } from "#test/contracts/notification/push-device-repository.contract";
import { InMemoryPushDeviceRepository } from "#test/doubles/notification/in-memory-push-device.repository";
import { InMemoryPushTokenRepository } from "#test/doubles/notification/in-memory-push-token.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describePushDeviceRepositoryContract(async () => {
  const tokens = new InMemoryPushTokenRepository();
  return { devices: new InMemoryPushDeviceRepository([], tokens), tokens };
});
