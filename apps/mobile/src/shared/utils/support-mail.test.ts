import { buildSupportMailUrl } from './support-mail';

describe('buildSupportMailUrl', () => {
  it('제목과 본문을 인코딩해 문의 주소로 보내는 mailto를 만든다', () => {
    // Given / When
    const url = buildSupportMailUrl({
      subject: '[아이두] 오류 문의 (IOS-1)',
      body: '코드: IOS-1\n',
    });

    // Then
    expect(url).toBe(
      `mailto:support@aido.kr?subject=${encodeURIComponent('[아이두] 오류 문의 (IOS-1)')}&body=${encodeURIComponent('코드: IOS-1\n')}`,
    );
  });
});
