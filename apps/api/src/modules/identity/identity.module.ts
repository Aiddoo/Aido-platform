import { Module } from "@nestjs/common";

import { IdentityLinkedAccountsModule } from "./linked-accounts/identity-linked-accounts.module.js";
import { IdentityOAuthStatesModule } from "./oauth-states/identity-oauth-states.module.js";
import { IdentitySessionsModule } from "./sessions/identity-sessions.module.js";
import { IdentityUserPreferencesModule } from "./user-preferences/identity-user-preferences.module.js";
import { IdentityUsersAdminModule } from "./users/identity-users-admin.module.js";
import { IdentityUsersModule } from "./users/identity-users.module.js";
import { IdentityVerificationsModule } from "./verifications/identity-verifications.module.js";

@Module({
  imports: [
    IdentitySessionsModule,
    IdentityVerificationsModule,
    IdentityOAuthStatesModule,
    IdentityLinkedAccountsModule,
    IdentityUsersModule,
    IdentityUsersAdminModule,
    IdentityUserPreferencesModule,
  ],
  exports: [IdentitySessionsModule, IdentityUsersModule, IdentityUserPreferencesModule],
})
export class IdentityModule {}
