import { Injectable } from "@nestjs/common";

import {
  type LocatedWeatherReport,
  type ReadWeatherReportsQuery,
  WeatherReportReaderPort,
} from "../../application/ports/weather-report.reader.port.js";
import { ReadWeatherReportsUseCase } from "../../application/use-cases/read-weather-reports.use-case.js";

// 다른 Context(날씨 알림)에 여는 문. 묶음 조회는 UseCase가 하고 이 어댑터는 포트 모양만 맞춘다
@Injectable()
export class WeatherReportReaderAdapter extends WeatherReportReaderPort {
  readonly #readWeatherReports: Pick<ReadWeatherReportsUseCase, "execute">;

  constructor(readWeatherReports: ReadWeatherReportsUseCase) {
    super();
    this.#readWeatherReports = readWeatherReports;
  }

  readReports(query: ReadWeatherReportsQuery): Promise<ReadonlyMap<string, LocatedWeatherReport>> {
    return this.#readWeatherReports.execute(query);
  }
}
