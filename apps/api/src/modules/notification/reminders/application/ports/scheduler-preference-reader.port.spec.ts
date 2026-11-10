import { describeSchedulerPreferenceReaderContract } from "#test/contracts/notification/scheduler-preference-reader.contract";
import { InMemorySchedulerPreferenceReader } from "#test/doubles/notification/in-memory-scheduler-preference.reader";

// 같은 계약을 integration에서는 Drizzle 리더로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeSchedulerPreferenceReaderContract(async () => {
  const reader = new InMemorySchedulerPreferenceReader();
  return {
    reader,
    givenPreference: (preference) => reader.givenPreference(preference),
    givenUserWithoutPreference: () => reader.givenUserWithoutPreference(),
  };
});
