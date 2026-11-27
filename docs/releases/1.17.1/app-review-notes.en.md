# Aido 1.17.1 review notes (draft)

**Status: draft, not entered in App Store Connect and not submitted.** The Notes field keeps the standing sections from the previous version (subscriptions, AI consent, permissions, invite rewards, where to find items) and replaces only the first part with the block below. Menu paths follow the code at this stack. We have not run these steps on a signed build yet. The demo account goes in the Sign-In Information fields, not in the notes. The App Store Notes field allows 4,000 characters.

## App Store Connect: App Review Information > Notes

```text
Aido 1.17.1 is a bug-fix and wording update with two small additions to Calendar import, which shipped in 1.17.0. It adds no new permissions and no purchase changes. Everything else is unchanged from the previous version.

What changed (user-visible)
- Tapping a button twice quickly, or again while a screen is closing after a save, now sends one request.
- Wording across the app is shorter and clearer.
- Tapping "Complete" on a task notification while offline now fails right away instead of running later after reconnecting.
- Notification text shows 24-hour times when the user chose the 24-hour format. Reminder times no longer shift when the device time zone cannot be read.
- Voice notes no longer pick up audio from another note, and "Keep talking" works after a failed start.
- Screens opened straight from a link close after saving, and leaving a screen while a save is in progress no longer closes another screen.
- Calendar import: the last step shows a one-line summary (number of events, date range, destination category). Accounts with no to-dos see a card on the To-dos tab that opens Calendar import. The card can be dismissed and uses the calendar permission already described for 1.17.0.
- Editing, pinning, or deleting a memo that was removed on another device now says the memo is gone and leaves the screen instead of failing repeatedly.

How to check
1. Sign in with the demo account.
2. Add a to-do, complete it, then delete it. Tapping Save twice quickly creates one to-do.
3. Voice notes need microphone and speech recognition permission, which are requested only when the user starts speaking.

Where to find other items
- Subscription price and period, Restore Purchases, Terms/Privacy: Me tab > Manage Subscription.
- Account deletion: Me tab > Delete Account (bottom). Web: https://aido.kr/en/account-deletion
```

## Google Play Console

- No change to Data safety or permissions from 1.17.0.

## Before pasting

- Confirm the menu names and button text against the signed build, and drop any "How to check" step we did not verify there.
- Add the demo account in the Sign-In fields.
