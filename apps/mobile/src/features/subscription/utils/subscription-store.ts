import type { PlatformOSType } from 'react-native';
import { match } from 'ts-pattern';

export type SubscriptionStore = 'appStore' | 'googlePlay';

/** 구독 결제·해지를 맡는 스토어. 인앱 구독이 없는 플랫폼은 null이다. */
export function getSubscriptionStore(os: PlatformOSType): SubscriptionStore | null {
  return match(os)
    .returnType<SubscriptionStore | null>()
    .with('ios', 'macos', () => 'appStore')
    .with('android', () => 'googlePlay')
    .with('web', 'windows', 'native', () => null)
    .exhaustive();
}
