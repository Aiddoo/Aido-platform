const EMAIL_DOMAINS = [
  'gmail.com',
  'naver.com',
  'daum.net',
  'outlook.com',
  'icloud.com',
  'kakao.com',
];

export const getEmailDomainSuggestions = (email: string) => {
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 1) return [];

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1).toLowerCase();
  if (EMAIL_DOMAINS.some((domain) => domain === domainPart)) return [];

  return EMAIL_DOMAINS.filter((domain) => domain.startsWith(domainPart))
    .slice(0, 3)
    .map((domain) => ({ domain, value: `${localPart}@${domain}` }));
};
