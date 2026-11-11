import { describeSubscriptionUserReaderContract } from "#test/contracts/billing/subscription-user-reader.contract";
import {
  type InMemorySubscriptionUser,
  InMemorySubscriptionUserReader,
} from "#test/doubles/billing/in-memory-subscription-user.reader";

// 같은 계약을 integration에서는 Drizzle reader로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeSubscriptionUserReaderContract(async () => {
  const users: InMemorySubscriptionUser[] = [];
  return {
    reader: new InMemorySubscriptionUserReader(users),
    seedUser: async ({ id, email, name, appUserAlias }) => {
      users.push({
        id,
        email,
        profile: name == null ? null : { name },
        ...(appUserAlias != null && { appUserAlias }),
      });
    },
  };
});
