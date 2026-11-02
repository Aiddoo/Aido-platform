import { buildSupportMailUrl, createDiagnosticCode } from './support-mail';

describe('createDiagnosticCode', () => {
  it('플랫폼·앱 버전·발생 시각만으로 코드를 만든다', () => {
    // Given
    const occurredAt = new Date('2026-11-03T00:00:00.000Z');

    // When
    const code = createDiagnosticCode({ platform: 'ios', appVersion: '1.14.0', occurredAt });

    // Then
    expect(code).toBe(`IOS-1.14.0-${occurredAt.getTime().toString(36).toUpperCase()}`);
  });

  it('앱 버전을 읽지 못하면 unknown으로 둔다', () => {
    // Given / When
    const code = createDiagnosticCode({
      platform: 'android',
      appVersion: null,
      occurredAt: new Date(0),
    });

    // Then
    expect(code).toBe('ANDROID-unknown-0');
  });
});

describe('buildSupportMailUrl', () => {
  it('제목과 본문을 인코딩해 문의 주소로 보내는 mailto를 만든다', () => {
    // Given / When
    const url = buildSupportMailUrl({ subject: '[Aido] 오류 문의 (IOS-1)', body: '코드: IOS-1\n' });

    // Then
    expect(url).toBe(
      `mailto:support@aido.kr?subject=${encodeURIComponent('[Aido] 오류 문의 (IOS-1)')}&body=${encodeURIComponent('코드: IOS-1\n')}`,
    );
  });
});
