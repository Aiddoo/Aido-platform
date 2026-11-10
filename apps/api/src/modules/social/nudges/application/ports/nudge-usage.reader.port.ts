import { DailySendUsageReaderPort } from "../../../cheers/application/ports/daily-send-usage.reader.port.js";

// 옛 Symbol 토큰. identity가 클래스 토큰으로 옮길 때까지 NudgeUsageReaderPort의 같은 인스턴스 별칭이다
export const NUDGE_USAGE_READER = Symbol("NUDGE_USAGE_READER");

export abstract class NudgeUsageReaderPort extends DailySendUsageReaderPort {}
