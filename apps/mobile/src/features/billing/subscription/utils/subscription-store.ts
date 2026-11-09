import type { PlatformOSType } from 'react-native';
import { match } from 'ts-pattern';

export type RenewalNoticeStore = 'appStore' | 'googlePlay';

/** 구독 결제·해지를 맡는 스토어. 인앱 구독이 없는 플랫폼은 null이다. */
export function findSubscriptionStore(os: PlatformOSType): RenewalNoticeStore | null {
  return match(os)
    .returnType<RenewalNoticeStore | null>()
    .with('ios', 'macos', () => 'appStore')
    .with('android', () => 'googlePlay')
    .with('web', 'windows', 'native', () => null)
    .exhaustive();
}
