import { Module } from "@nestjs/common";

import { IdentityAuthModule } from "./auth/identity-auth.module.js";
import { IdentityPreferencesModule } from "./preferences/identity-preferences.module.js";
import { IdentityUsersAdminModule } from "./users/identity-users-admin.module.js";
import { IdentityUsersModule } from "./users/identity-users.module.js";

@Module({
  imports: [
    IdentityAuthModule,
    IdentityUsersModule,
    IdentityUsersAdminModule,
    IdentityPreferencesModule,
  ],
  exports: [IdentityAuthModule, IdentityUsersModule, IdentityPreferencesModule],
})
export class IdentityModule {}
