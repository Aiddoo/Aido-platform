/** 바깥 감시자가 기대하는 생존 신호 주기. */
export interface JobHeartbeatSchedule {
  readonly cron: string;
  readonly timezone: string;
  /** 예정 시각부터 이 시간(분) 안에 신호가 없으면 놓친 것으로 본다 */
  readonly graceMinutes: number;
  /** 시작 신호 뒤 이 시간(분) 안에 끝나지 않으면 실패로 본다 */
  readonly maxRuntimeMinutes: number;
  /** 연속으로 이만큼 놓치거나 실패해야 사람에게 알린다. 배포로 한 번 빠지는 것은 넘긴다 */
  readonly failuresBeforeAlert: number;
}

/**
 * 작업 worker가 살아 있음을 바깥 감시자에게 알린다(dead man's switch). worker나 pg-boss가 통째로 멈추면
 * 신호가 끊겨 감시자가 경보한다. 신호 전송 실패는 호출 흐름에 전파하지 않는다.
 */
export abstract class JobHeartbeatPort {
  /** work를 실행하며 시작·끝을 알린다. work의 결과와 오류는 그대로 돌려준다. */
  abstract monitor<T>(schedule: JobHeartbeatSchedule, work: () => Promise<T>): Promise<T>;
}
