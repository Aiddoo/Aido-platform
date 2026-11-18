import { UserTimezoneReaderPort } from "#api/modules/identity/user-preferences/identity-user-preferences.public";

export class StubUserTimezoneReader extends UserTimezoneReaderPort {
  timezone: string | null = "Asia/Seoul";

  async findStoredTimezone(): Promise<string | null> {
    return this.timezone;
  }
}
