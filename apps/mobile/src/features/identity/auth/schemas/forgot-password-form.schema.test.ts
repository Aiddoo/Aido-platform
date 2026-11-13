import { forgotPasswordFormSchema } from './forgot-password-form.schema';

const validForgotPassword = {
  email: 'user@example.com',
  code: '123456',
  newPassword: 'Password123',
  newPasswordConfirm: 'Password123',
};

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('forgotPasswordFormSchema', () => {
  it('숫자가 아닌 인증 코드는 거부한다', () => {
    // When
    const result = forgotPasswordFormSchema.safeParse({ ...validForgotPassword, code: '12a456' });

    // Then
    expect(issuePaths(result)).toEqual(['code']);
  });

  it('확장 후에도 새 비밀번호 확인 불일치 규칙을 유지한다', () => {
    // When
    const result = forgotPasswordFormSchema.safeParse({
      ...validForgotPassword,
      newPasswordConfirm: 'Password124',
    });

    // Then
    expect(issuePaths(result)).toEqual(['newPasswordConfirm']);
  });
});
