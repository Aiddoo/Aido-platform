/**
 * 문의 이메일 템플릿
 */
export interface InquiryTemplateData {
	userEmail: string;
	category: string;
	categoryLabel: string;
	content: string;
	submittedAt: string;
}

export function getInquirySubject(categoryLabel: string): string {
	return `[Aido] 새로운 문의: ${categoryLabel}`;
}

export function getInquiryHtml(data: InquiryTemplateData): string {
	return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>새로운 문의</title>
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
                새로운 문의가 접수되었습니다
              </h2>

              <!-- Info Table -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px; font-size: 14px; color: #666666; border-bottom: 1px solid #eee; width: 120px;">
                    <strong>사용자 이메일</strong>
                  </td>
                  <td style="padding: 12px; font-size: 14px; color: #1a1a1a; border-bottom: 1px solid #eee;">
                    ${data.userEmail}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-size: 14px; color: #666666; border-bottom: 1px solid #eee;">
                    <strong>카테고리</strong>
                  </td>
                  <td style="padding: 12px; font-size: 14px; color: #1a1a1a; border-bottom: 1px solid #eee;">
                    ${data.categoryLabel}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-size: 14px; color: #666666; border-bottom: 1px solid #eee;">
                    <strong>접수 시각</strong>
                  </td>
                  <td style="padding: 12px; font-size: 14px; color: #1a1a1a; border-bottom: 1px solid #eee;">
                    ${data.submittedAt}
                  </td>
                </tr>
              </table>

              <!-- Content Box -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #666666;">
                  문의 내용
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.8; color: #1a1a1a; white-space: pre-wrap;">${data.content}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 20px;" />
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #999999; text-align: center;">
                이 이메일은 Aido 앱에서 자동으로 발송되었습니다.
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

export function getInquiryText(data: InquiryTemplateData): string {
	return `
[Aido] 새로운 문의: ${data.categoryLabel}

사용자 이메일: ${data.userEmail}
카테고리: ${data.categoryLabel}
접수 시각: ${data.submittedAt}

--- 문의 내용 ---
${data.content}

이 이메일은 Aido 앱에서 자동으로 발송되었습니다.
  `.trim();
}
