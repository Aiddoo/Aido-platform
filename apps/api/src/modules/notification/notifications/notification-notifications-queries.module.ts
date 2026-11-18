import { Module } from "@nestjs/common";

import { UnreadNotificationCountReaderPort } from "./application/ports/unread-notification-count.reader.port.js";
import { DrizzleNotificationReader } from "./infrastructure/persistence/drizzle-notification.reader.js";

// 푸시 발송이 배지에 실을 안 읽은 수만 연다. 기능 Module은 푸시 발송 Module을 import하므로 이 Module은
// 다른 Module을 import하지 않아 순환하지 않는다
@Module({
  providers: [{ provide: UnreadNotificationCountReaderPort, useClass: DrizzleNotificationReader }],
  exports: [UnreadNotificationCountReaderPort],
})
export class NotificationNotificationsQueriesModule {}
