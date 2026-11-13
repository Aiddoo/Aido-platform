import { WEATHER_CONDITIONS } from '@aido/api';
import { z } from 'zod';

import {
  WEATHER_SCENE_MAX_PRECIPITATION_ANGLE,
  getMoonIllumination,
  toWeatherScene,
  type WeatherSceneInput,
} from './weather-scene.view-model';

const unit = z.number().min(0).max(1);
const weatherSceneRangeSchema = z.object({
  precipitation: z.object({
    density: unit,
    speed: unit,
    angle: z.number().min(0).max(WEATHER_SCENE_MAX_PRECIPITATION_ANGLE),
  }),
  clouds: unit,
  fog: unit,
  wind: unit,
  moonPhase: unit,
});

const createInput = (overrides: Partial<WeatherSceneInput> = {}): WeatherSceneInput => ({
  condition: 'CLEAR',
  isDaylight: true,
  precipitationIntensity: 0,
  cloudCover: 0,
  windSpeed: 0,
  moonPhase: 'FULL',
  latitude: 37.5,
  ...overrides,
});

describe('toWeatherScene', () => {
  describe('날씨 장면 변환', () => {
    it.each(
      WEATHER_CONDITIONS.flatMap((condition) => [
        [condition, true] as const,
        [condition, false] as const,
      ]),
    )('%s 상태(낮 %s)는 각 값이 범위 안에 있는 장면이 된다', (condition, isDaylight) => {
      // Given
      const input = createInput({ condition, isDaylight, cloudCover: 50, windSpeed: 4 });

      // When
      const scene = toWeatherScene(input);

      // Then
      expect(weatherSceneRangeSchema.safeParse(scene).success).toBe(true);
      expect(scene.isDaylight).toBe(isDaylight);
    });

    it.each([
      ['DRIZZLE', 'drizzle'],
      ['RAIN', 'rain'],
      ['SLEET', 'sleet'],
      ['SNOW', 'snow'],
      ['HAIL', 'hail'],
      ['CLEAR', 'none'],
      ['FOGGY', 'none'],
    ] as const)('%s 상태의 강수 종류는 %s이다', (condition, kind) => {
      // Given
      const input = createInput({ condition });

      // When
      const scene = toWeatherScene(input);

      // Then
      expect(scene.precipitation.kind).toBe(kind);
    });

    it('맑은 낮에는 렌즈 반사가 있는 해를, 맑은 밤에는 달·별·별똥별을 보여 준다', () => {
      // Given
      const day = createInput({ isDaylight: true });
      const night = createInput({ isDaylight: false });

      // When
      const [dayScene, nightScene] = [day, night].map(toWeatherScene);

      // Then
      expect(dayScene).toMatchObject({
        sky: 'clearDay',
        sun: 'bright',
        hasLensFlare: true,
        hasMoon: false,
        hasStars: false,
      });
      expect(nightScene).toMatchObject({
        sky: 'clearNight',
        sun: 'hidden',
        hasLensFlare: false,
        hasMoon: true,
        hasStars: true,
        hasShootingStars: true,
      });
    });

    it('흐린 밤은 해·달·별·서리 없이 흐린 밤하늘만 그린다', () => {
      // Given
      const input = createInput({ condition: 'CLOUDY', isDaylight: false, cloudCover: 90 });

      // When
      const scene = toWeatherScene(input);

      // Then
      expect(scene).toMatchObject({
        sky: 'overcastNight',
        atmosphere: 'calm',
        sun: 'hidden',
        hasLensFlare: false,
        hasMoon: false,
        hasStars: false,
      });
    });

    it('번개는 천둥번개에서만 친다', () => {
      // Given
      const conditions = WEATHER_CONDITIONS.map((condition) => createInput({ condition }));

      // When
      const withLightning = conditions
        .map(toWeatherScene)
        .flatMap((scene, index) => (scene.hasLightning ? [conditions[index]?.condition] : []));

      // Then
      expect(withLightning).toEqual(['THUNDERSTORMS']);
    });

    it('안개 밤에는 달과 별이 가려진다', () => {
      // Given
      const input = createInput({ condition: 'FOGGY', isDaylight: false, cloudCover: 0 });

      // When
      const scene = toWeatherScene(input);

      // Then
      expect(scene).toMatchObject({ hasMoon: false, hasStars: false });
    });
  });

  describe('달의 위상', () => {
    it('서버가 준 오늘의 위상을 한 바퀴 0~1 자리에 놓는다', () => {
      // Given
      const full = createInput({ isDaylight: false, moonPhase: 'FULL' });
      const firstQuarter = createInput({ isDaylight: false, moonPhase: 'FIRST_QUARTER' });

      // When
      const fullScene = toWeatherScene(full);
      const firstQuarterScene = toWeatherScene(firstQuarter);

      // Then
      expect(fullScene.moonPhase).toBe(0.5);
      expect(firstQuarterScene.moonPhase).toBe(0.25);
    });

    it('일별 예보가 없어 위상을 모르면 밤에도 달을 그리지 않는다', () => {
      // Given
      const input = createInput({ isDaylight: false, moonPhase: null });

      // When
      const scene = toWeatherScene(input);

      // Then
      expect(scene.hasMoon).toBe(false);
    });

    it('보름달은 다 밝고 삭은 보이지 않는다', () => {
      // When
      const [full, fresh] = [0.5, 0].map(getMoonIllumination);

      // Then
      expect(full).toBeCloseTo(1);
      expect(fresh).toBeCloseTo(0);
    });

    it('남반구 위치에서는 달을 뒤집어 그리도록 알린다', () => {
      // Given
      const input = createInput({ isDaylight: false, latitude: -33.9 });

      // When
      const scene = toWeatherScene(input);

      // Then
      expect(scene.isSouthernHemisphere).toBe(true);
    });
  });
});
