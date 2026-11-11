import type { SchedulerPreferenceReaderPort } from "#api/modules/notification/reminders/application/ports/scheduler-preference-reader.port";

export interface SchedulerPreferenceReaderContractSubject {
  readonly reader: SchedulerPreferenceReaderPort;
  givenPreference(preference: {
    readonly timezone: string;
    readonly locale: string;
  }): Promise<string>;
  givenUserWithoutPreference(): Promise<string>;
}

// 두 조회 모두 순서를 약속하지 않아 정렬해서 비교한다
export function describeSchedulerPreferenceReaderContract(
  createSubject: () => Promise<SchedulerPreferenceReaderContractSubject>,
): void {
  describe("스케줄러 설정 리더 계약", () => {
    it("저장된 시간대를 한 번씩만 주고 런타임이 모르는 시간대는 빼며 별칭은 저장값 그대로 준다", async () => {
      // Given
      const subject = await createSubject();
      await subject.givenPreference({ timezone: "Asia/Seoul", locale: "ko" });
      await subject.givenPreference({ timezone: "Asia/Seoul", locale: "en" });
      await subject.givenPreference({ timezone: "America/New_York", locale: "en" });
      await subject.givenPreference({ timezone: "US/Eastern", locale: "en" });
      await subject.givenPreference({ timezone: "Invalid/Timezone", locale: "ko" });

      // When
      const timezones = await subject.reader.findActiveTimezones();

      // Then
      expect(timezones.toSorted()).toEqual(["America/New_York", "Asia/Seoul", "US/Eastern"]);
    });

    it("사용자별 푸시 언어는 저장한 앱 언어로 정하고 지원하지 않는 언어는 en, 설정이 없는 사용자는 빠진다", async () => {
      // Given
      const subject = await createSubject();
      const korean = await subject.givenPreference({ timezone: "Asia/Seoul", locale: "ko" });
      const regionalEnglish = await subject.givenPreference({
        timezone: "Asia/Seoul",
        locale: "en-US",
      });
      const french = await subject.givenPreference({ timezone: "Europe/Paris", locale: "fr" });
      const withoutPreference = await subject.givenUserWithoutPreference();

      // When
      const locales = await subject.reader.findUserLocales([
        korean,
        regionalEnglish,
        french,
        withoutPreference,
      ]);

      // Then
      expect(
        [...locales.entries()].toSorted(([left], [right]) => left.localeCompare(right)),
      ).toEqual(
        [
          [korean, "ko"],
          [regionalEnglish, "en"],
          [french, "en"],
        ].toSorted(([left = ""], [right = ""]) => left.localeCompare(right)),
      );
    });

    it("묻는 사용자가 없으면 빈 결과를 준다", async () => {
      // Given
      const subject = await createSubject();
      await subject.givenPreference({ timezone: "Asia/Seoul", locale: "ko" });

      // When
      const locales = await subject.reader.findUserLocales([]);

      // Then
      expect(locales.size).toBe(0);
    });
  });
}
