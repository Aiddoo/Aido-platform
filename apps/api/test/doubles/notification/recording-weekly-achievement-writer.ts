import {
  type WeeklyAchievementTally,
  WeeklyAchievementWriterPort,
} from "#api/modules/notification/reminders/application/ports/weekly-achievement-writer.port";

type RecordedTally = Omit<WeeklyAchievementTally, "userId"> & { readonly userId: string };

// 넘겨받은 주간 달성 기록을 저장 호출 단위로 남긴다. 비교하기 쉽게 사용자 id는 값으로 남긴다
export class RecordingWeeklyAchievementWriter extends WeeklyAchievementWriterPort {
  readonly writes: RecordedTally[][] = [];

  async execute(input: { readonly records: readonly WeeklyAchievementTally[] }): Promise<void> {
    this.writes.push(input.records.map((record) => ({ ...record, userId: record.userId.value })));
  }

  get records(): RecordedTally[] {
    return this.writes.flat();
  }
}
