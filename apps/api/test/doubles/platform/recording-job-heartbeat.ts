import {
  JobHeartbeatPort,
  type JobHeartbeatSchedule,
} from "#api/shared/application/ports/job-heartbeat.port";

// 바깥 감시자 대신 신호를 보낸 주기와 성공·실패만 모은다
export class RecordingJobHeartbeat extends JobHeartbeatPort {
  readonly schedules: JobHeartbeatSchedule[] = [];
  succeeded = 0;
  failed = 0;

  async monitor<T>(schedule: JobHeartbeatSchedule, work: () => Promise<T>): Promise<T> {
    this.schedules.push(schedule);
    try {
      const result = await work();
      this.succeeded += 1;
      return result;
    } catch (error) {
      this.failed += 1;
      throw error;
    }
  }
}
