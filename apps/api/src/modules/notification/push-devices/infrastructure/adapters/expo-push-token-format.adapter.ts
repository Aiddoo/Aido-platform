import { Injectable } from "@nestjs/common";
import { Expo } from "expo-server-sdk";

import type { PushTokenFormatPort } from "../../application/ports/push-token-format.port.js";

@Injectable()
export class ExpoPushTokenFormatAdapter implements PushTokenFormatPort {
  isValid(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }
}
