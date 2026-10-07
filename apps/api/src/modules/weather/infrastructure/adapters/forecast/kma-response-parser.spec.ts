import { parseKmaResponse } from "./kma-response-parser.js";

describe("KMA 응답 날짜 선택", () => {
  it("서버 TZ와 무관하게 KST 대상일·다음 날을 선택하고 반환 Date는 원 instant를 유지한다", () => {
    // Given
    const date = new Date("2026-07-23T16:00:00Z");
    const response = {
      response: {
        header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
        body: {
          items: {
            item: [
              { category: "TMP", fcstDate: "20260723", fcstTime: "0900", fcstValue: "13" },
              { category: "TMP", fcstDate: "20260724", fcstTime: "0900", fcstValue: "24" },
              { category: "TMP", fcstDate: "20260725", fcstTime: "0900", fcstValue: "25" },
            ],
          },
        },
      },
    };
    // When
    const result = parseKmaResponse(response, date);
    // Then
    expect(result.date).toBe(date);
    expect(result.hourlyForecasts.map((hourly) => hourly.temperature)).toEqual([24, 25]);
    expect(result.dailyForecasts.map((daily) => daily.date)).toEqual([
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
    ]);
  });
});
