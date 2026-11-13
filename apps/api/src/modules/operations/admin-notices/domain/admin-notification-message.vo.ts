import { ValueObject } from "#api/shared/domain/model/value-object";

import { adminNoticeBodyEmpty, adminNoticeTitleEmpty } from "./admin-notices.errors.js";

interface AdminNotificationCopy {
  readonly title: string;
  readonly body: string;
}

export class AdminNotificationMessage extends ValueObject<AdminNotificationCopy> {
  static create(input: AdminNotificationCopy): AdminNotificationMessage {
    if (input.title.trim().length === 0) {
      throw adminNoticeTitleEmpty();
    }
    if (input.body.trim().length === 0) {
      throw adminNoticeBodyEmpty();
    }
    return new AdminNotificationMessage({ title: input.title, body: input.body });
  }

  get title(): string {
    return this.value.title;
  }

  get body(): string {
    return this.value.body;
  }
}
