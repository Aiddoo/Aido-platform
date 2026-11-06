import { createInquirySchema, INQUIRY_CATEGORY, INQUIRY_CONTENT_LIMITS } from '@aido/api';

import { inquiryFormSchema } from './inquiry-form.schema';

const { MIN_LENGTH, MAX_LENGTH } = INQUIRY_CONTENT_LIMITS;

function parse(content: string) {
  return inquiryFormSchema.safeParse({ category: INQUIRY_CATEGORY.OTHER, content });
}

describe('문의 폼 규칙', () => {
  it('공백만 있는 내용은 길이가 채워져도 보내지 않는다', () => {
    // Given
    const content = ' '.repeat(MIN_LENGTH) + '\n'.repeat(MIN_LENGTH);

    // When
    const result = parse(content);

    // Then
    expect(result.success).toBe(false);
  });

  it('앞뒤 공백은 빼고 보내며 그 글자로 최소 길이를 센다', () => {
    // Given
    const tooShort = `   ${'가'.repeat(MIN_LENGTH - 1)}   `;
    const enough = `\n  ${'가'.repeat(MIN_LENGTH)}  \n`;

    // When
    const short = parse(tooShort);
    const ok = parse(enough);

    // Then
    expect(short.success).toBe(false);
    expect(ok.success && ok.data.content).toBe('가'.repeat(MIN_LENGTH));
  });

  it('최대 길이는 서버와 같은 글자 수로 센다', () => {
    // Given
    const atLimit = 'a'.repeat(MAX_LENGTH);
    const overLimit = 'a'.repeat(MAX_LENGTH + 1);

    // When
    const atResult = parse(atLimit);
    const overResult = parse(overLimit);

    // Then
    expect(atResult.success).toBe(true);
    expect(overResult.success).toBe(false);
  });

  it.each([
    ['이모지', '😀'.repeat(MAX_LENGTH / 2)],
    ['이모지 한도 초과', '😀'.repeat(MAX_LENGTH / 2 + 1)],
    ['줄바꿈', `첫 줄입니다\r\n둘째 줄입니다\n\n셋째 줄`],
    ['결합 글자', '👨‍👩‍👧'.repeat(300)],
  ])(
    '%s가 있어도 통과한 글자는 서버 규칙도 통과하고 막힌 글자는 서버도 막는다',
    (_name, content) => {
      // Given
      const request = { category: INQUIRY_CATEGORY.OTHER, content };

      // When
      const form = inquiryFormSchema.safeParse(request);
      const server = createInquirySchema.safeParse(
        form.success ? form.data : { ...request, content: content.trim() },
      );

      // Then
      expect(form.success).toBe(server.success);
    },
  );
});
