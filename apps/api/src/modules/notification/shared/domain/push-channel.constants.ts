// 앱은 채널을 모르고 서버만 토큰을 채널로 나눠 보내므로 서버 어휘다. DB PushToken.provider 값이라 추가만 한다
export const PUSH_CHANNELS = ["EXPO"] as const;

export type PushChannel = (typeof PUSH_CHANNELS)[number];

export function toPushChannel(value: string): PushChannel | null {
  return PUSH_CHANNELS.find((channel) => channel === value) ?? null;
}
