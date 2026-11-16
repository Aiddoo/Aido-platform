import { UserTimezoneReaderPort } from "#api/modules/identity/identity-settings.public";

export class StubUserTimezoneReader extends UserTimezoneReaderPort {
  timezone: string | null = "Asia/Seoul";

  async findStoredTimezone(): Promise<string | null> {
    return this.timezone;
  }
}
