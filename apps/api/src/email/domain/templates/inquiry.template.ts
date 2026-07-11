import type { InquiryCategory } from "@aido/validators";

/**
 * 문의 이메일 템플릿
 */
export interface InquiryTemplateData {
	userEmail: string;
	category: InquiryCategory;
	categoryLabel: string;
	content: string;
	submittedAt: string;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function getInquirySubject(categoryLabel: string): string {
	return `[Aido 문의접수] [${categoryLabel}]`;
}

export function getInquiryHtml(data: InquiryTemplateData): string {
	const escapedUserEmail = escapeHtml(data.userEmail);
	const escapedCategoryLabel = escapeHtml(data.categoryLabel);
	const escapedSubmittedAt = escapeHtml(data.submittedAt);
	const escapedContent = escapeHtml(data.content);

	return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aido 문의 접수 알림</title>
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
              <p style="margin: 8px 0 0; font-size: 13px; color: #666666;">
                문의 접수 알림
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1a1a1a; text-align: center;">
                새로운 문의가 접수되었습니다
              </h2>

              <!-- Summary -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 14px; color: #1a1a1a; line-height: 1.6;">
                  CS 처리 시 아래 정보를 먼저 확인해 주세요.
                </p>
              </div>

              <!-- Inquiry Info -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px; font-size: 14px; color: #666666; border-bottom: 1px solid #eee; width: 120px;">
                    <strong>사용자 이메일</strong>
                  </td>
                  <td style="padding: 12px; font-size: 14px; color: #1a1a1a; border-bottom: 1px solid #eee;">
                    ${escapedUserEmail}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-size: 14px; color: #666666; border-bottom: 1px solid #eee;">
                    <strong>카테고리</strong>
                  </td>
                  <td style="padding: 12px; font-size: 14px; color: #1a1a1a; border-bottom: 1px solid #eee;">
                    ${escapedCategoryLabel}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-size: 14px; color: #666666; border-bottom: 1px solid #eee;">
                    <strong>접수 시각</strong>
                  </td>
                  <td style="padding: 12px; font-size: 14px; color: #1a1a1a; border-bottom: 1px solid #eee;">
                    ${escapedSubmittedAt}
                  </td>
                </tr>
              </table>

              <!-- Inquiry Content -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #666666;">
                  문의 내용
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.8; color: #1a1a1a; white-space: pre-wrap;">${escapedContent}</p>
              </div>

              <!-- CS Checklist -->
              <div style="background-color: #fff7e6; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid #ffe0a3;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #8a5a00;">
                  CS 처리 체크리스트
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 1.7; color: #8a5a00;">
                  1) 문의 유형 분류 2) 재현/확인 필요 여부 판단 3) 사용자 회신 문안 작성
                </p>
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
[Aido 문의접수] [${data.categoryLabel}] ${data.userEmail}

[접수 정보]
- 사용자 이메일: ${data.userEmail}
- 카테고리: ${data.categoryLabel}
- 접수 시각: ${data.submittedAt}

[문의 내용]
${data.content}

[CS 처리 메모]
- 상태: 신규 접수
- 우선순위: 미분류
- 담당자: 미배정

[후속 액션]
- 유형 분류 및 재현 확인
- 사용자 회신 초안 작성

이 이메일은 Aido 앱에서 자동으로 발송되었습니다.
  `.trim();
}
