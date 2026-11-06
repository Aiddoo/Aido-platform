import { toCloudCoverNote, toVisibilityKilometers } from './weather-detail.view-model';

describe('toVisibilityKilometers', () => {
  it.each([
    [16000, 16],
    [6000, 6],
    [1240, 1.2],
  ] as const)('가시거리 %dm는 %fkm로 보여 준다', (meters, kilometers) => {
    // Given 가시거리(m) When 표시 값을 구하면 Then 10km 미만만 소수 한 자리다
    expect(toVisibilityKilometers(meters)).toBe(kilometers);
  });
});

describe('toCloudCoverNote', () => {
  it.each([
    [90, true, 'overcast'],
    [50, true, 'brokenDay'],
    [50, false, 'brokenNight'],
    [10, true, 'clearDay'],
    [0, false, 'clearNight'],
  ] as const)('운량 %s%%, 낮 %s이면 %s 문구다', (cloudCover, isDaylight, note) => {
    // Given 운량과 낮밤 When 구름 문구를 고르면 Then 단계와 낮밤에 맞는 문구다
    expect(toCloudCoverNote(cloudCover, isDaylight)).toBe(note);
  });
});
