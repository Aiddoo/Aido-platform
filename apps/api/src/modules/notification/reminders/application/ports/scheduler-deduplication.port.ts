import type { NudgePairMark } from "../../domain/nudge-pair-mark.vo.js";
import type { WinbackStageMark } from "../../domain/winback-stage-mark.vo.js";

// 단계·주 단위로 한 번만 보내는 재유입 알림의 발송 표시. 찾기는 준 표시 중 아직 남기지 않은 것을 같은 인스턴스로 돌려준다
export abstract class SchedulerDeduplicationPort {
  abstract filterUnsentWinbackStages(
    marks: readonly WinbackStageMark[],
  ): Promise<WinbackStageMark[]>;
  abstract recordWinbackStages(marks: readonly WinbackStageMark[]): Promise<void>;
  abstract filterUnsentNudgePairs(marks: readonly NudgePairMark[]): Promise<NudgePairMark[]>;
  abstract recordNudgePairs(marks: readonly NudgePairMark[]): Promise<void>;
}
