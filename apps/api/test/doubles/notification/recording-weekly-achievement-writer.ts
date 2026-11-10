import {
  type WeeklyAchievementTally,
  WeeklyAchievementWriterPort,
} from "#api/modules/notification/reminders/application/ports/weekly-achievement-writer.port";

// 넘겨받은 주간 달성 기록을 저장 호출 단위로 남긴다
export class RecordingWeeklyAchievementWriter extends WeeklyAchievementWriterPort {
  readonly writes: WeeklyAchievementTally[][] = [];

  async execute(input: { readonly records: readonly WeeklyAchievementTally[] }): Promise<void> {
    this.writes.push([...input.records]);
  }

  get records(): WeeklyAchievementTally[] {
    return this.writes.flat();
  }
}
