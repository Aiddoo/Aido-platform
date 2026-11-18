import { Module } from "@nestjs/common";

import { SocialCheersModule } from "./cheers/social-cheers.module.js";
import { SocialFriendshipsModule } from "./friendships/social-friendships.module.js";
import { SocialInviteRedemptionsModule } from "./invite-redemptions/social-invite-redemptions.module.js";
import { SocialInvitesModule } from "./invites/social-invites.module.js";
import { SocialNudgesModule } from "./nudges/social-nudges.module.js";
import { SocialReminderNudgesModule } from "./reminder-nudges/social-reminder-nudges.module.js";
import { SocialUserBlocksModule } from "./user-blocks/social-user-blocks.module.js";
import { SocialUserReportsAdminModule } from "./user-reports/social-user-reports-admin.module.js";
import { SocialUserReportsModule } from "./user-reports/social-user-reports.module.js";

@Module({
  imports: [
    SocialUserBlocksModule,
    SocialCheersModule,
    SocialFriendshipsModule,
    SocialNudgesModule,
    SocialReminderNudgesModule,
    SocialInvitesModule,
    SocialInviteRedemptionsModule,
    SocialUserReportsModule,
    SocialUserReportsAdminModule,
  ],
  exports: [
    SocialUserBlocksModule,
    SocialCheersModule,
    SocialFriendshipsModule,
    SocialNudgesModule,
    SocialReminderNudgesModule,
    SocialInvitesModule,
    SocialInviteRedemptionsModule,
    SocialUserReportsModule,
    SocialUserReportsAdminModule,
  ],
})
export class SocialModule {}
