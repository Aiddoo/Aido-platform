import type { DeviceType } from "@aido/api/vocabulary";

import type { AccountProvider } from "../../../linked-accounts/domain/linked-accounts.constants.js";

export interface UserRegisteredNotification {
  userId: string;
  email: string;
  provider: Lowercase<AccountProvider>;
  registeredAt: string;
  name?: string;
  devicePlatform?: DeviceType;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  appBuild?: string;
  locale?: string;
  timezone?: string;
}

export abstract class UserRegistrationNotifierPort {
  abstract notifyUserRegistered(payload: UserRegisteredNotification): void;
}
