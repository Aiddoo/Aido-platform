// 콕 답장·감사 기능 스위치. 꺼져 있으면 관련 API는 없는 콕처럼 응답한다
export abstract class NudgeInteractionConfigPort {
  abstract readonly isEnabled: boolean;
}
