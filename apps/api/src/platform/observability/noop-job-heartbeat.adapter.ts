import {
  JobHeartbeatPort,
  type JobHeartbeatSchedule,
} from "#api/shared/application/ports/job-heartbeat.port";

/** 바깥 감시자가 없는 환경(개발·스테이징·테스트, DSN 없음)에서는 신호 없이 work만 실행한다. */
export class NoopJobHeartbeatAdapter extends JobHeartbeatPort {
  async monitor<T>(_schedule: JobHeartbeatSchedule, work: () => Promise<T>): Promise<T> {
    return work();
  }
}
