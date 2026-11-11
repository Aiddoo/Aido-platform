import type { SupportedLocale } from "@aido/api/vocabulary";

import { BroadcastRecipientReaderPort } from "#api/modules/operations/broadcasts/application/ports/broadcast-recipient.reader.port";
import type { BroadcastRecipient } from "#api/modules/operations/broadcasts/application/read-models/broadcast-recipient.read-model";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

interface RecipientSetting {
  readonly locale?: SupportedLocale;
  readonly timeZone?: string;
}

// 설정이 없는 사용자는 저장값이 없는 사용자의 기본값(ko, 서울)을 받는다
export class StubBroadcastRecipientReader extends BroadcastRecipientReaderPort {
  readonly #settings: ReadonlyMap<string, RecipientSetting>;

  constructor(settings: Readonly<Record<string, RecipientSetting>> = {}) {
    super();
    this.#settings = new Map(Object.entries(settings));
  }

  async listRecipients(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, BroadcastRecipient>> {
    return new Map(
      userIds.map(({ value }) => {
        const setting = this.#settings.get(value);
        return [
          value,
          {
            locale: setting?.locale ?? "ko",
            timeZone: TimeZone.reconstitute(setting?.timeZone ?? "Asia/Seoul"),
          },
        ];
      }),
    );
  }
}
