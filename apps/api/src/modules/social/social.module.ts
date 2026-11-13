import { Module } from "@nestjs/common";

import { SocialBlocksModule } from "./blocks/social-blocks.module.js";
import { SocialCheersModule } from "./cheers/social-cheers.module.js";
import { SocialFriendsModule } from "./friends/social-friends.module.js";
import { SocialInvitesModule } from "./invites/social-invites.module.js";
import { SocialNudgesModule } from "./nudges/social-nudges.module.js";
import { SocialReminderNudgesModule } from "./reminder-nudges/social-reminder-nudges.module.js";
import { SocialReportsAdminModule } from "./reports/social-reports-admin.module.js";
import { SocialReportsModule } from "./reports/social-reports.module.js";

@Module({
  imports: [
    SocialBlocksModule,
    SocialCheersModule,
    SocialFriendsModule,
    SocialNudgesModule,
    SocialReminderNudgesModule,
    SocialInvitesModule,
    SocialReportsModule,
    SocialReportsAdminModule,
  ],
  exports: [
    SocialBlocksModule,
    SocialCheersModule,
    SocialFriendsModule,
    SocialNudgesModule,
    SocialReminderNudgesModule,
    SocialInvitesModule,
    SocialReportsModule,
    SocialReportsAdminModule,
  ],
})
export class SocialModule {}
