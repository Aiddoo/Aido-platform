# Aido 1.17.0 review notes (draft)

**Status: entered and saved in App Store Connect on 2026-11-24, not submitted.** The Notes field keeps the standing sections from the previous version (subscriptions, AI consent, permissions, invite rewards, where to find items) and replaces only the first part with a 764-character version of the block below, so the whole field fits 4,000 characters. Menu paths follow the code at this stack. We have not run these steps on a signed build yet. Data declarations follow [privacy-label.md](privacy-label.md). The App Store Notes field allows 4,000 characters. The demo account goes in the Sign-In Information fields, not in the notes.

## App Store Connect: App Review Information > Notes

```text
Aido 1.17.0 adds Import calendar events. Everything else is unchanged from the previous version.

How to test Import calendar events
1. Before opening Aido, add a few events to the Calendar app on the test device (for example, an event tomorrow at 10:00 and an all-day event next week). Use a calendar on the device (iCloud or "On My iPhone").
2. In Aido, sign in with the demo account.
3. Me tab > Settings > Import calendar events.
4. The first screen explains what Aido reads and sends. Tap "Continue". The system calendar permission prompt appears only after this tap.
5. Choose Allow Full Access. Select a calendar and a range (for example "1 month"). Holiday, birthday and subscribed calendars start unchecked.
6. Connect each calendar to a new or an existing category, or tap "Put all in one category".
7. Options: "Include times" (on by default; off imports dates only, with no reminders) and "Share with friends" (off by default).
8. Tap "Import". The import runs on our server, so you may leave the app. When it finishes, you see how many to-dos came in and why any were skipped.
9. Undo is available for 7 days. It removes only imported to-dos that are not completed.
10. Free accounts can import events up to 30 days ahead, Premium up to 365 days. Importing itself is free, and no purchase is required for it.

Why full calendar access is needed
- On iOS 17 and later, reading events requires full calendar access. Write-only access cannot read events, so Aido requests full access (NSCalendarsFullAccessUsageDescription).
- Aido only reads calendars. It never creates, edits, or deletes events. Reminders access is not requested.
- Permission is requested only after the user taps "Continue" on the explanation screen, never at launch. If the user denies it, every other feature keeps working, Aido does not ask again, and the screen shows only an "Open Settings" button when the system will not ask again.
- The app does not require granting access for any other feature, and no payment depends on it.

Data
- Only the title, date, and time of the events the user chooses are sent to the Aido server, once, when the user taps "Import". Calendar and event identifiers are hashed (SHA-256) on the device. Attendees, notes, and locations are not read.
- This is declared in App Privacy (User Content > Other User Content, linked to the user, not used for tracking, App Functionality).

Where to find other items
- Subscription price and period, Restore Purchases, Terms/Privacy: Me tab > Manage Subscription.
- Account deletion: Me tab > Delete Account (bottom). Web: https://aido.kr/en/account-deletion
```

## Google Play Console

- Data safety: Calendar > Calendar events, collected, not shared, optional, App functionality, encrypted in transit, deletion can be requested.
- Permissions: `READ_CALENDAR` only. `WRITE_CALENDAR` is blocked in the build. It is not a restricted permission, so no Declaration Form is needed (plan-time reading of the policy, to be confirmed in the console).

## Before pasting

- Confirm the menu names and button text against the signed build.
- Check the character count of the block above and add the demo account in the Sign-In fields.
- Do not submit before the privacy policy update on aido.kr takes effect (2026-12-01).
