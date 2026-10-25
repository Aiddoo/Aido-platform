import type { UserReportReason, UserReportTargetType } from "@aido/api/vocabulary";
import { escape } from "es-toolkit";

/** 운영자에게 보내는 사용자 신고 접수 알림. 신고자 이메일은 담지 않는다. */
export interface UserReportTemplateData {
  reportId: string;
  reporterId: string;
  reporterTag: string;
  targetUserId: string;
  targetUserTag: string;
  targetType: UserReportTargetType;
  targetTypeLabel: string;
  targetId: string | null;
  reason: UserReportReason;
  reasonLabel: string;
  detail: string | null;
  submittedAt: string;
  /** 처리 완료 API 경로. 운영자가 조치 내용을 남길 곳이다 */
  resolutionEndpoint: string;
  /** 관리자 API 문서에서 처리 API를 바로 여는 링크. 기준 주소가 없으면 null */
  resolutionDocsUrl: string | null;
}

export function getUserReportSubject(data: UserReportTemplateData): string {
  return `[Aido 신고접수] [${data.reasonLabel}] ${data.targetTypeLabel} · ${data.targetUserTag}`;
}

function row(label: string, value: string): string {
  return `
                <tr>
                  <td style="padding: 12px; font-size: 14px; color: #666666; border-bottom: 1px solid #eee; width: 140px;">
                    <strong>${escape(label)}</strong>
                  </td>
                  <td style="padding: 12px; font-size: 14px; color: #1a1a1a; border-bottom: 1px solid #eee; word-break: break-all;">
                    ${escape(value)}
                  </td>
                </tr>`;
}

export function getUserReportHtml(data: UserReportTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aido 신고 접수 알림</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px;">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">Aido</h1>
              <p style="margin: 8px 0 0; font-size: 13px; color: #666666;">사용자 신고 접수 알림</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1a1a1a; text-align: center;">
                새로운 신고가 접수되었습니다
              </h2>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">${[
                row("신고 ID", data.reportId),
                row("사유", `${data.reasonLabel} (${data.reason})`),
                row("대상 종류", `${data.targetTypeLabel} (${data.targetType})`),
                row("콘텐츠 ID", data.targetId ?? "-"),
                row("신고된 사용자", `${data.targetUserTag} · ${data.targetUserId}`),
                row("신고한 사용자", `${data.reporterTag} · ${data.reporterId}`),
                row("접수 시각", data.submittedAt),
                row("처리 API", data.resolutionEndpoint),
              ].join("")}
              </table>
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #666666;">신고 내용</p>
                <p style="margin: 0; font-size: 14px; line-height: 1.8; color: #1a1a1a; white-space: pre-wrap;">${escape(data.detail ?? "(상세 내용 없음)")}</p>
              </div>
              <div style="background-color: #fff7e6; border-radius: 8px; padding: 16px 20px; border: 1px solid #ffe0a3;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #8a5a00;">처리 체크리스트</p>
                <p style="margin: 0; font-size: 13px; line-height: 1.7; color: #8a5a00;">
                  1) 콘텐츠 ID로 원문 확인 2) 약관 위반이면 콘텐츠 삭제·계정 제한 3) 처리 API로 조치 내용을 남겨 RESOLVED로 변경
                </p>
              </div>${
                data.resolutionDocsUrl == null
                  ? ""
                  : `
              <p style="margin: 24px 0 0; text-align: center;">
                <a href="${escape(data.resolutionDocsUrl)}" style="display: inline-block; padding: 12px 20px; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #1a1a1a; border-radius: 8px; text-decoration: none;">관리자 문서에서 처리하기</a>
              </p>`
              }
            </td>
          </tr>
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

export function getUserReportText(data: UserReportTemplateData): string {
  return `
[Aido 신고접수] [${data.reasonLabel}] ${data.targetTypeLabel} · ${data.targetUserTag}

[접수 정보]
- 신고 ID: ${data.reportId}
- 사유: ${data.reasonLabel} (${data.reason})
- 대상 종류: ${data.targetTypeLabel} (${data.targetType})
- 콘텐츠 ID: ${data.targetId ?? "-"}
- 신고된 사용자: ${data.targetUserTag} · ${data.targetUserId}
- 신고한 사용자: ${data.reporterTag} · ${data.reporterId}
- 접수 시각: ${data.submittedAt}
- 처리 API: ${data.resolutionEndpoint}${data.resolutionDocsUrl == null ? "" : `\n- 관리자 문서: ${data.resolutionDocsUrl}`}

[신고 내용]
${data.detail ?? "(상세 내용 없음)"}

[처리 체크리스트]
1) 콘텐츠 ID로 원문 확인
2) 약관 위반이면 콘텐츠 삭제·계정 제한
3) 처리 API로 조치 내용을 남겨 RESOLVED로 변경

이 이메일은 Aido 앱에서 자동으로 발송되었습니다.
  `.trim();
}
