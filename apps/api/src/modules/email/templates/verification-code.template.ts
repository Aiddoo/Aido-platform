/**
 * 이메일 인증 코드 템플릿
 */
export interface VerificationCodeTemplateData {
	code: string;
	expiryMinutes: number;
}

export function getVerificationCodeSubject(): string {
	return "[Aido] 이메일 인증 코드";
}

export function getVerificationCodeHtml(
	data: VerificationCodeTemplateData,
): string {
	return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>이메일 인증</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">
                Aido
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1a1a1a; text-align: center;">
                이메일 인증 코드
              </h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #666666; text-align: center;">
                아래 인증 코드를 앱에 입력해주세요.
              </p>

              <!-- Code Box -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">
                  ${data.code}
                </span>
              </div>

              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #999999; text-align: center;">
                이 코드는 <strong>${data.expiryMinutes}분</strong> 후에 만료됩니다.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 20px;" />
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #999999; text-align: center;">
                본인이 요청하지 않은 경우, 이 이메일을 무시하셔도 됩니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getVerificationCodeText(
	data: VerificationCodeTemplateData,
): string {
	return `
[Aido] 이메일 인증 코드

인증 코드: ${data.code}

이 코드는 ${data.expiryMinutes}분 후에 만료됩니다.

본인이 요청하지 않은 경우, 이 이메일을 무시하셔도 됩니다.
  `.trim();
}
