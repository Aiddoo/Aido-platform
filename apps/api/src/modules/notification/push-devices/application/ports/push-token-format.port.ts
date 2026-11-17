// 기기가 보고한 토큰이 발송 채널이 받는 형식인지 본다. 채널 이름은 어댑터에만 둔다
export abstract class PushTokenFormatPort {
  abstract isValid(token: string): boolean;
}
