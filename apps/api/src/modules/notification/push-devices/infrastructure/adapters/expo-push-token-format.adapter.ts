import { Injectable } from "@nestjs/common";
import { Expo } from "expo-server-sdk";
import { match } from "ts-pattern";

import type { PushChannel } from "../../../shared/domain/push-channel.constants.js";
import type { PushTokenFormatPort } from "../../application/ports/push-token-format.port.js";

@Injectable()
export class ExpoPushTokenFormatAdapter implements PushTokenFormatPort {
  accepts(channel: PushChannel, token: string): boolean {
    return match(channel)
      .with("EXPO", () => Expo.isExpoPushToken(token))
      .exhaustive();
  }
}
