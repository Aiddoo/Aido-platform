/**
 * 이 확률(%) 이상일 때만 아이콘 아래에 강수 확률 숫자를 적는다. 낮은 확률까지 적으면 아이콘 줄이 무거워져 숨긴다.
 * 시간별·일별 예보가 함께 쓴다. 비 오는 시간으로 보는 기준(`ForecastHourPolicy.isWet`, 서버와 같은 50%)과는
 * 다른 값이라 20~49% 시간은 숫자는 보이지만 비 오는 시간으로 안내하지 않는다
 */
export const LABELED_PRECIPITATION_CHANCE_MIN_PERCENT = 20;

/** 예보 일수. 할 일 점을 찍을 날 수와 로딩 행 수도 같다 */
export const FORECAST_DAYS = 10;
