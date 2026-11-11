import {
  type ReminderWeatherReport,
  ReminderWeatherReportReaderPort,
  type ReminderWeatherReportRequest,
} from "#api/modules/notification/reminders/application/ports/reminder-weather-report.reader.port";

// 키별 리포트를 돌려주고 요청을 기록한다. 리포트가 없는 키는 조회 실패와 같다
export class StubReminderWeatherReportReader extends ReminderWeatherReportReaderPort {
  readonly requests: (readonly ReminderWeatherReportRequest[])[] = [];
  readonly reports = new Map<string, ReminderWeatherReport>();

  async readReports(
    requests: readonly ReminderWeatherReportRequest[],
  ): Promise<ReadonlyMap<string, ReminderWeatherReport>> {
    this.requests.push(requests);
    return new Map(
      requests.flatMap((request) => {
        const report = this.reports.get(request.key);
        return report == null ? [] : [[request.key, report] as const];
      }),
    );
  }
}
