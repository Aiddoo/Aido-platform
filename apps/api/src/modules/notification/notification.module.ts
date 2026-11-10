import { Module } from "@nestjs/common";

import { NotificationInboxModule } from "./inbox/notification-inbox.public.js";
import { NotificationEmailModule } from "./notification-email.module.js";
import { NotificationRemindersModule } from "./notification-reminders.module.js";
import { NotificationRetentionModule } from "./notification-retention.module.js";
import { NotificationPushModule } from "./push/notification-push.public.js";

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
