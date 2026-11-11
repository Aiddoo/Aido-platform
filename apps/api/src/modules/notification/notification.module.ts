import { Module } from "@nestjs/common";

import { NotificationEmailModule } from "./email/notification-email.module.js";
import { NotificationInboxModule } from "./inbox/notification-inbox.public.js";
import { NotificationPushModule } from "./push/notification-push.public.js";
import { NotificationRemindersModule } from "./reminders/notification-reminders.module.js";
import { NotificationRetentionModule } from "./retention/notification-retention.module.js";

// email·reminders·retention은 slice 폴더로 옮기기 전까지 옛 구조 모듈을 그대로 조립한다
@Module({
  imports: [
    NotificationInboxModule,
    NotificationPushModule,
    NotificationEmailModule,
    NotificationRemindersModule,
    NotificationRetentionModule,
  ],
  exports: [
    NotificationInboxModule,
    NotificationPushModule,
    NotificationEmailModule,
    NotificationRemindersModule,
    NotificationRetentionModule,
  ],
})
export class NotificationModule {}
