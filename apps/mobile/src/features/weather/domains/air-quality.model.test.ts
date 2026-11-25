import { createAirQuality } from '../__tests__/weather-report.fixtures';
import { AirQualityPolicy } from './air-quality.model';

describe('AirQualityPolicy', () => {
  describe('findPollutantGrade', () => {
    it.each([
      ['pm10', 30, 'good'],
      ['pm10', 31, 'moderate'],
      ['pm10', 80, 'moderate'],
      ['pm10', 81, 'bad'],
      ['pm10', 151, 'veryBad'],
      ['pm25', 15, 'good'],
      ['pm25', 16, 'moderate'],
      ['pm25', 36, 'bad'],
      ['pm25', 76, 'veryBad'],
    ] as const)('%s가 %s μg/m³이면 %s 등급이다', (pollutant, value, expected) => {
      // Given
      const airQuality = createAirQuality(pollutant === 'pm10' ? { pm10: value } : { pm25: value });

      // When
      const grade = AirQualityPolicy.findPollutantGrade(airQuality, pollutant);

      // Then
      expect(grade).toBe(expected);
    });

    it('고른 오염 물질의 값이 없으면 다른 물질이 나빠도 null이다', () => {
      // Given
      const airQuality = createAirQuality({ pm10: 200, pm25: null });

      // When
      const grade = AirQualityPolicy.findPollutantGrade(airQuality, 'pm25');

      // Then
      expect(grade).toBeNull();
    });

    it('고른 오염 물질만 보고 다른 물질의 값은 등급에 섞지 않는다', () => {
      // Given
      const airQuality = createAirQuality({ pm10: 200, pm25: 10 });

      // When
      const grade = AirQualityPolicy.findPollutantGrade(airQuality, 'pm25');

      // Then
      expect(grade).toBe('good');
    });
  });
});
