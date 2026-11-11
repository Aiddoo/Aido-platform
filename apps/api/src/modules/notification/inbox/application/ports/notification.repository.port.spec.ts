import { describeNotificationRepositoryContract } from "#test/contracts/notification/notification-repository.contract";
import { InMemoryNotificationRepository } from "#test/doubles/notification/in-memory-notification.repository";

// 같은 계약을 integration에서는 Drizzle 저장소·조회기로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeNotificationRepositoryContract(async () => {
  const store = new InMemoryNotificationRepository();
  return { repository: store, inboxReader: store, historyReader: store };
});
