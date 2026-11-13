import { toStoreUnavailableReport } from './store-unavailable-report.view-model';

describe('toStoreUnavailableReport', () => {
  it.each([
    [
      '배포 빌드의 설정 문제는 error 이벤트로 남긴다',
      'setup',
      false,
      { channel: 'event', severity: 'error' },
    ],
    [
      '배포 빌드에서 스토어가 잠시 응답하지 못하면 warning 이벤트로 남긴다',
      'temporary',
      false,
      { channel: 'event', severity: 'warning' },
    ],
    ['개발 빌드는 Test Store라 설정 문제도 로그만 남긴다', 'setup', true, { channel: 'log' }],
  ] as const)('%s', (_case, kind, isDebugBuild, expected) => {
    // When
    const report = toStoreUnavailableReport(kind, { isDebugBuild });

    // Then
    expect(report).toEqual(expected);
  });
});
