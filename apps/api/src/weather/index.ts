/**
 * Weather 모듈 공개 API
 *
 * Facade는 크로스 모듈(스케줄러·ai-suggestion) 소비용, 예보/격자 타입은 계약.
 */

export * from "./application/facades/weather.facade";
export * from "./application/ports/weather-provider.port";
export type { GridInput } from "./application/services/weather-forecast.reader";
export * from "./weather.module";
