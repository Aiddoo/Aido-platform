import { Module } from "@nestjs/common";

import { NotificationEmailMessagesModule } from "./email-messages/notification-email-messages.module.js";
import { NotificationNotificationsModule } from "./notifications/notification-notifications.module.js";
import { NotificationPushDevicesModule } from "./push-devices/notification-push-devices.module.js";
import { NotificationPushDispatchesModule } from "./push-dispatches/notification-push-dispatches.module.js";
import { NotificationRemindersModule } from "./reminders/notification-reminders.module.js";
import { NotificationRetentionAssignmentsModule } from "./retention-assignments/notification-retention-assignments.module.js";

@Module({
  imports: [
    NotificationPushDevicesModule,
    NotificationPushDispatchesModule,
    NotificationNotificationsModule,
    NotificationEmailMessagesModule,
    NotificationRemindersModule,
    NotificationRetentionAssignmentsModule,
  ],
  exports: [
    NotificationPushDevicesModule,
    NotificationPushDispatchesModule,
    NotificationNotificationsModule,
    NotificationEmailMessagesModule,
    NotificationRemindersModule,
    NotificationRetentionAssignmentsModule,
  ],
})
export class NotificationModule {}
