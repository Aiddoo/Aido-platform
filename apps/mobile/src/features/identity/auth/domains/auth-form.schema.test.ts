import { forgotPasswordFormSchema } from './forgot-password-form.schema';
import { signUpFormSchema } from './sign-up-form.schema';

const validSignUp = {
  email: 'User@Example.com',
  password: 'Password123',
  passwordConfirm: 'Password123',
  name: '아이두',
  termsAgreed: false,
  privacyAgreed: false,
  marketingAgreed: false,
  marketingPushAgreed: false,
};

const validForgotPassword = {
  email: 'user@example.com',
  code: '123456',
  newPassword: 'Password123',
  newPasswordConfirm: 'Password123',
};

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('signUpFormSchema', () => {
  it('약관 동의 전(false)에도 입력 단계를 통과하고 이메일은 서버 규칙대로 정규화한다', () => {
    // When
    const result = signUpFormSchema.safeParse(validSignUp);

    // Then
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('user@example.com');
  });

  it('서버 계약에서는 선택인 닉네임을 회원가입 폼에서는 필수로 요구한다', () => {
    // When
    const result = signUpFormSchema.safeParse({ ...validSignUp, name: '' });

    // Then
    expect(issuePaths(result)).toEqual(['name']);
  });

  it('비밀번호 확인이 다르면 passwordConfirm 필드 오류로 알린다', () => {
    // When
    const result = signUpFormSchema.safeParse({ ...validSignUp, passwordConfirm: 'Password124' });

    // Then
    expect(issuePaths(result)).toEqual(['passwordConfirm']);
  });
});

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
