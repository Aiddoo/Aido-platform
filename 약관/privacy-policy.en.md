# Aido Privacy Policy

**Effective Date: March 13, 2026**

---

RedBand (hereinafter "Company") complies with the Personal Information Protection Act, the Act on Promotion of Information and Communications Network Utilization and Information Protection, and other applicable laws, and establishes and discloses this Privacy Policy to safely process users' personal information.

---

## Article 1 (Purpose of This Privacy Policy)

This Privacy Policy is intended to inform users about the processing of personal information collected and used in the course of using "Aido" (hereinafter "Service"), an AI-powered social to-do management service provided by the Company.

---

## Article 2 (Personal Information Collected and Collection Methods)

### 2-1. Directly Provided by Users

| Category | Items Collected | Required/Optional |
|----------|----------------|-------------------|
| Email Registration | Email address, password, User Tag (UserTag) | Required |
| Profile Settings | Name (nickname), profile image | Optional |
| Customer Inquiries | Inquiry content, contact information for response | Required |
| Marketing Consent | Marketing consent status, consent timestamp | Optional |

- **Right to Refuse Optional Items**: Users may decline to provide optional items. Refusal does not restrict access to the basic functions of the Service. However, certain supplementary features such as profile display and marketing information may be limited.

### 2-2. Automatically Collected During Service Use

| Items Collected | Purpose of Collection |
|----------------|----------------------|
| Device Information (Device ID, Platform (iOS/Android), User-Agent) | Service optimization, security |
| IP Address | Prevention of fraudulent use, access record management |
| App Usage Records (access time, screen views, event logs) | Service improvement, error response |
| Push Token (Expo Push Token) | Notification delivery |
| Error and Crash Information (Crashlytics) | App stability improvement |
| Timezone Information (IANA format) | Notification and reminder timezone settings |
| Last Login Timestamp | Fraudulent use detection, account management |
| Last Active Timestamp | Inactive user detection, service improvement |
| Device Fingerprint (User-Agent + IP hash) | Session security, unauthorized access detection |
| Daily AI Usage Count | Usage limit management per subscription plan |

### 2-3. Device Permission Access (On-Device Processing)

The following items are accessed with the user's consent and are **processed only on the device; they are not transmitted to the Company's servers.**

| Access Item | Purpose |
|-------------|---------|
| Camera | Taking profile photos |
| Photo Library | Selecting profile images |
| Microphone and Speech Recognition | Voice input for to-do creation (voice data is processed on-device, not transmitted to server) |

- Users may change or revoke access permissions at any time through their device settings.

### 2-4. Information Received from Third Parties via Social Login (OAuth)

| OAuth Provider | Items Received |
|---------------|---------------|
| **Google** | Email address, name, profile image |
| **Kakao** | Email address, nickname, profile image |
| **Naver** | Email address, name, profile image |
| **Apple** | Email address (name is provided only at initial login; email may be masked per Apple's policy) |

- Information received through social login is subject to the respective OAuth provider's policies and may vary depending on the privacy settings configured by the user with that provider.

---

## Article 3 (Purpose of Processing Personal Information)

The Company processes collected personal information only for the following purposes:

| Purpose | Details |
|---------|---------|
| Member Management | Member identification, registration/withdrawal processing, identity verification, prevention of fraudulent use |
| Service Provision | Core features including task management, calendar (weekly/monthly), friend sharing, Nudge, Cheer, Social Digest (weekly summary of friends' activities), weekly achievement badges, and streaks. Publicly shared to-dos are visible to mutual followers, and Nudge and Cheer messages are delivered to the recipient. |
| AI Feature Provision | AI-powered automatic to-do parsing, weekly & monthly AI report generation (task statistics analysis and achievement summaries), recurring pattern analysis and automatic suggestions |
| Subscription and Payment Management | Paid subscription processing, payment status management, receipt verification |
| Notification Delivery | To-do reminders (1 hour and 10 minutes before scheduled time), morning & evening reminders, streak maintenance reminders, social notifications (friend requests, Nudge, Cheer, social digest, etc.), Nudge encouragement notifications, Win-back notifications, service announcements |
| Service Improvement | Usage statistics analysis, error response, service quality enhancement |
| Customer Support | Inquiry response, complaint handling, notice delivery |
| Marketing (Optional) | Providing event and promotional information (only to consenting Members) |

---

## Article 4 (Retention and Use Period of Personal Information)

The Company destroys personal information without delay once the purpose of collection and use has been achieved. However, where retention is required by applicable laws, information is retained for the following periods:

| Retained Items | Retention Period | Legal Basis |
|---------------|-----------------|-------------|
| Records related to contracts or withdrawal of offers | **5 years** | Act on Consumer Protection in Electronic Commerce, Article 6 |
| Records related to payment and supply of goods | **5 years** | Act on Consumer Protection in Electronic Commerce, Article 6 |
| Records related to consumer complaints or dispute resolution | **3 years** | Act on Consumer Protection in Electronic Commerce, Article 6 |
| Records related to advertising and display | **6 months** | Act on Consumer Protection in Electronic Commerce, Article 6 |
| Service access records (login records, access logs) | **3 months** | Protection of Communications Secrets Act, Article 15-2 |
| Records related to identity verification | **6 months** | Act on Promotion of ICT Network Utilization, Article 44-5 |

### Service Operational Data Retention Periods

| Data Item | Retention Period | Basis |
|-----------|-----------------|-------|
| Security Logs (SecurityLog) | **90 days** | Fraud prevention and security auditing |
| Login Attempt Records (LoginAttempt) | **30 days** | Abnormal login detection and prevention |
| Notification Data (Notification) | **90 days** | Notification history and service provision |
| Session Information (Session) | **Until session expiry or revocation** | Authentication and access management |
| Daily Completion Records (DailyCompletion) | **Until Member withdrawal** | Core service provision (streaks, statistics) |
| Weekly Achievement Records (WeeklyAchievement) | **Until Member withdrawal** | Weekly achievement badges and statistics |
| AI Reports (AiReport) | **Until Member withdrawal** | AI report viewing service provision |

- Upon Member withdrawal, the Company applies a **30-day grace period** before destroying personal information. If the Member logs in again within the grace period, the account is restored. After the grace period, personal information is permanently deleted except for information that must be retained under the legally mandated retention periods above.

---

## Article 5 (Provision of Personal Information to Third Parties)

The Company does not provide personal information to third parties without the user's consent, except in the following cases:

1. When the user has given prior consent
2. When required by law, or when requested by investigative authorities in accordance with procedures and methods prescribed by law

---

## Article 6 (Entrustment of Personal Information Processing)

The Company entrusts personal information processing to the following parties for service provision:

| Entrusted Party | Entrusted Tasks | Items Processed |
|----------------|-----------------|-----------------|
| **RevenueCat, Inc.** | Subscription payment management, receipt verification | Subscription status, product ID, purchase history, user identifier mapping (revenueCatUserId) |
| **Apple Inc.** | In-app payment processing, social login | Payment information, authentication information |
| **Google LLC** | In-app payment processing, social login, AI features (Gemini API), Firebase services | Payment information, authentication information, to-do text (AI), analytics data |
| **Kakao Corp.** | Social login | Authentication information |
| **Naver Corp.** | Social login | Authentication information |
| **Functional Software, Inc. (Sentry)** | Server error tracking, stability monitoring | Error logs, request information, IP address |
| **Resend, Inc.** | Email delivery (verification, notification emails) | Email address |
| **650 Industries, Inc. (Expo)** | Push notification delivery | Push tokens, device information |

Entrustment contracts specify restrictions on processing personal information beyond the scope of entrusted tasks, technical and organizational safeguards, restrictions on re-entrustment, and management and supervision, in accordance with the Personal Information Protection Act.

---

## Article 7 (Cross-Border Transfer of Personal Information)

The Company transfers personal information overseas for service provision as follows:

| Recipient | Country | Items Transferred | Purpose | Retention Period |
|-----------|---------|------------------|---------|-----------------|
| **Google LLC** (Firebase Analytics) | United States | App usage records, device information | Service usage statistical analysis | Until Member withdrawal or purpose fulfillment |
| **Google LLC** (Firebase Crashlytics) | United States | Error information, device information | App stability improvement | 180 days |
| **Google LLC** (Gemini API) | United States | To-do text | AI feature provision (to-do parsing) | Deleted immediately upon API processing completion (per Google's policy) |
| **RevenueCat, Inc.** | United States | Subscription status, purchase history, user identifier mapping (revenueCatUserId) | Subscription payment management | Service use period + legally mandated retention period |
| **Apple Inc.** | United States | Authentication information, payment information | Social login, in-app payment | Per each service's policy |
| **Functional Software, Inc. (Sentry)** | United States | Error logs, request information, IP address | Server error tracking, stability monitoring | 90 days |
| **650 Industries, Inc. (Expo)** | United States | Push tokens, device information | Push notification delivery | Duration of service use |
| **Resend, Inc.** | United States | Email address | Email delivery (verification, notification) | Duration of service use |

- Transfer Method: Transmission via encrypted network communication (HTTPS/TLS)
- Users may refuse consent to cross-border transfer; however, access to related features may be restricted.

---

## Article 8 (Data Processing for AI Features)

1. The Service transmits Members' data to an external AI service (Google Gemini API) to provide the following AI features:
   - **Automatic To-Do Parsing**: Transmits to-do text to automatically extract title, date, category, and other details
   - **Weekly & Monthly AI Reports**: Transmits task statistics (total completions, per-category completions, day-of-week and time-of-day completion distributions, streak status, week-over-week/month-over-month changes, and other aggregated data) to generate achievement summaries and personalized tips
   - **Recurring Pattern Analysis**: Transmits task titles, scheduled times, and category information to detect recurring patterns and generate suggestions
2. Only the data items specified above are transmitted; personally identifiable information such as email addresses and names is not transmitted.
3. Transmitted data is processed solely for the purpose of generating AI responses. The Company does not use this data for advertising or marketing purposes without separate consent.
4. Details regarding data processing by the external AI service are subject to the privacy policy of the respective provider (Google).

---

## Article 9 (Automated Decision-Making)

1. The Service may perform the following **automated decisions** using AI and automation technologies:
   - Automatic parsing of to-do text (extracting title, date, category, etc.)
   - Automatic generation of weekly and monthly AI reports (for premium users)
   - Recurring pattern detection and automatic task suggestions (for premium users)
   - Automatic to-do reminder delivery (1 hour and 10 minutes before the scheduled time)
   - Feature usage restrictions based on subscription status (daily usage limits, etc.)
2. Automated decisions do not have a **significant impact** on Members' rights or obligations and are intended for providing reference information or service operations.
3. Members may exercise the following rights regarding automated decisions:
   - Request an **explanation** of the automated decision
   - **Object** to the automated decision and request reprocessing with human intervention
4. These rights may be exercised by contacting customer support at dydals3440@gmail.com.

---

## Article 10 (Operation and Opt-Out of Automatic Collection Tools (SDKs))

1. The Company uses the following SDKs (Software Development Kits) to automatically collect information for service improvement and error response:

   | SDK | Purpose | Items Collected |
   |-----|---------|----------------|
   | **Firebase Analytics** | Service usage statistics, user behavior analysis | Screen views, event logs, device information, session information |
   | **Firebase Crashlytics** | App error tracking, stability improvement | Error/crash logs, device information, OS version |
   | **Sentry** | Server error tracking, stability monitoring | Error logs, request information, device information |

2. **Behavioral Information Collection Notice**: The Company collects Members' in-app behavioral information (screen views, feature usage patterns, etc.) through Firebase Analytics for service improvement.
3. **How to Opt Out**: Users may restrict analytics data sharing through device settings or opt out by uninstalling the app. However, opting out may limit service quality improvements.

---

## Article 11 (Procedure and Method of Personal Information Destruction)

1. **Destruction Procedure**: Personal information is destroyed without delay after the retention period has elapsed or the processing purpose has been achieved. Information that must be retained by law is stored separately in a dedicated database (or table) and destroyed upon expiration of the retention period.
2. **Destruction Method**:
   - Electronic files: Permanently deleted using methods that prevent recovery
   - Paper documents: Shredded or incinerated

---

## Article 12 (User Rights and How to Exercise Them)

1. Users (or their legal representatives) may exercise the following rights at any time:
   - Request to **access** personal information
   - Request to **correct** errors
   - Request **deletion**
   - Request **suspension of processing**
   - Request **account withdrawal**
   - Request **personal information transfer** (right to data portability under Article 35-2 of the Personal Information Protection Act)
2. **Data Portability Notice**: Users may request that their personal information be transferred to themselves or a third party. The Company shall inform users of the scope of transferable personal information and transfer formats in accordance with the Personal Information Protection Act and related enforcement decrees.
3. Rights may be exercised in writing, via email (dydals3440@gmail.com), or through in-app settings. The Company shall take action without delay.
4. If a user requests correction of errors in personal information, the Company shall not use or provide the information until the correction is completed.
5. Users may exercise their rights through a legal representative or authorized agent, in which case a power of attorney must be submitted in accordance with the Enforcement Rules of the Personal Information Protection Act.

---

## Article 13 (Measures for Personal Information Protection)

The Company implements the following technical, organizational, and physical safeguards for the safe processing of personal information:

### Technical Measures
- Encryption of personal information: Passwords are hashed using the Argon2id algorithm; sensitive information (tokens, etc.) is encrypted using AES-256-GCM
- Encryption of data transmission (HTTPS/TLS)
- Minimization of access privileges and access control
- Security updates and vulnerability assessments

### Organizational Measures
- Minimization of personnel with access to personal information
- Management and monitoring of personal information access logs
- Establishment and enforcement of internal security policies

### Physical Measures
- Infrastructure operated on cloud services (AWS, etc.), with physical security governed by the cloud provider's policies

---

## Article 14 (Personal Information of Children Under 14)

1. The Service is **not intended for children under 14**, and the Company does not accept membership registration from children under 14.
2. During registration, users confirm that they are 14 or older through the terms agreement process, and registration is restricted for users under 14.
3. If the Company becomes aware that personal information of a child under 14 has been collected, it shall destroy such information without delay.

---

## Article 15 (Personal Information Protection Officer)

The Company designates the following Personal Information Protection Officer to oversee personal information processing and handle user complaints and damage relief:

| Item | Details |
|------|---------|
| Name | Kim Yongmin |
| Position | Representative (concurrent) |
| Phone | 010-5877-8951 |
| Email | dydals3440@gmail.com |

Inquiries, complaints, and damage relief requests related to personal information may be submitted via the contact information above. The Company shall respond and provide processing results without delay.

---

## Article 16 (Personal Information Breach Relief Agencies)

For reports or consultations regarding personal information breaches, you may contact the following agencies:

| Agency | Contact | Website |
|--------|---------|---------|
| Personal Information Infringement Report Center (KISA) | (No area code) 118 | privacy.kisa.or.kr |
| Personal Information Dispute Mediation Committee | (No area code) 1833-6972 | kopico.go.kr |
| Supreme Prosecutors' Office Cyber Investigation Division | (No area code) 1301 | spo.go.kr |
| National Police Agency Cyber Bureau | (No area code) 182 | ecrm.police.go.kr |

---

## Article 17 (Changes to This Privacy Policy)

1. This Privacy Policy may be amended to reflect changes in laws, policies, or the Service.
2. In case of significant changes, the Company shall provide at least **7 days' prior notice** through in-app announcements or push notifications before the effective date.
3. For changes that significantly affect users' rights, at least **30 days' prior notice** shall be given through individual notification (email or push notification).

---

## Addendum

1. This Privacy Policy takes effect on **March 13, 2026**.
2. The previous Privacy Policy (effective March 10, 2026) shall cease to have effect upon the implementation of this Policy.
