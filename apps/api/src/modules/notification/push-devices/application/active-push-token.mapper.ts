import { toPushChannel } from "../../shared/domain/push-channel.constants.js";
import type { ActivePushTokenReadModel } from "./read-models/active-push-token.read-model.js";
import type { PushTokenReadModel } from "./read-models/push-token.read-model.js";

// 이 서버가 모르는 채널의 토큰(더 새 서버가 등록한 값)은 보낼 수 없어 뺀다
export function toActivePushTokens(
  records: readonly PushTokenReadModel[],
): ActivePushTokenReadModel[] {
  return records.flatMap((record) => {
    const channel = toPushChannel(record.provider);
    return channel == null ? [] : [{ token: record.token, channel, appVersion: record.appVersion }];
  });
}
