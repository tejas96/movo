# MOVO – Play Console "App content" answers

Play Console → Policy and programs → **App content**. Answer each form once. Answers below match the code as of 2026-09-27 (M0–M10). If a feature changes (analytics, crash reporting, payments, location), come back here, to the Data safety form and to `site/privacy.html` together.

## 1. Privacy policy

`https://tejas96.github.io/movo/privacy.html`

## 2. Ads

**Does your app contain ads?** No, my app does not contain ads.

(No ads SDK in `apps/mobile/package.json`; the privacy policy says "No ads".)

## 3. App access

**All or some functionality is restricted** → Add instructions.

Every screen needs a signed-in member of a society, so the reviewer needs a ready account. Before sending a build to review, create on the **production** server:

1. A society named e.g. "MOVO Review Society" (platform admin → create society), with 1–2 wings and a few flats.
2. A reviewer account that is a member of that society with the **admin** role (so every module and Manage society are visible), linked to one flat.
3. Some sample content so screens are not empty: two notices, one upcoming meeting and one event, a monthly billing plan with one bill and one recorded payment, one expense, one duty rotation, one open task, two vendors, and one or two Market listings from a second account.
4. Keep this account out of real societies. Do not change its password without updating the form.

Text to paste (Play has fields: name, username, password, other information):

```text
Instruction name: Reviewer login (society admin)
Username / phone: +91XXXXXXXXXX            <- phone of the reviewer account
Password: ********                          <- its password
Any other information:
1. Open MOVO and tap "Sign in". Enter the phone number (or email) and password above.
2. The account is already a member and admin of the demo society "MOVO Review Society", flat A-101. No invite code or OTP is needed.
3. Bottom tabs: Home, Society (all modules), Money (dues, receipts, treasurer tools), Market (neighbour listings), Me (profile, language, privacy, delete account).
4. MOVO does not process payments. Maintenance payments are recorded by the committee; Market buyers and sellers pay each other outside the app.
5. Please do not use "Delete my account" on this reviewer account; if you need to test deletion, create a new account with "Create account" and delete that one (Me → Delete my account).
```

## 4. Content rating (IARC questionnaire)

Email: `tejas96patil@gmail.com`. Category: **All other app types** (utility, productivity, communication or other; not a game, not social networking as the primary purpose).

| Question (wording varies slightly) | Answer | Why |
| --- | --- | --- |
| Violence (realistic, fantasy, blood, gore) | No | – |
| Fear / horror | No | – |
| Sexuality, nudity | No | – |
| Language (profanity, crude humour) | No | App content is written by the committee and members; no built-in profanity |
| Controlled substances (drugs, alcohol, tobacco) | No | The Market is for homemade food and household items; the app does not feature or promote alcohol or tobacco |
| Gambling, simulated gambling, real-money betting | No | – |
| Discriminatory / hateful content | No | – |
| **Does the app allow users to interact or exchange content with other users?** | **Yes** | Committee notices, event RSVPs, emergency alerts to the society, Market listings, buyer–seller order messages and reviews, all among members of the same society |
| Is user interaction moderated / can users report? | Yes (if asked) | Members can report Market listings; moderators hide them. Committee controls notices and membership |
| **Does the app share the user's current physical location with other users?** | **No** | No location permission or GPS use; emergency alerts carry no coordinates. The flat number is a society record, not device location |
| **Does the app allow users to purchase digital goods?** | **No** | Nothing is sold or paid in the app |
| Does the app contain or allow access to unrestricted internet (a web browser)? | No | No in-app browser; links hand off to the system (privacy page, UPI app, phone dialer) |
| Is the app a news app? | No | – |
| Does the app share personal info with third parties? (if asked) | No | Only processors (hosting, FCM, email) |

Expected result: lowest age rating everywhere (IARC 3+, ESRB Everyone, PEGI 3) with the interactive element **"Users Interact"**. That rating is about content; it is separate from the target audience below.

## 5. Target audience and content

| Question | Answer |
| --- | --- |
| Target age groups | **18 and over** only. Do not tick 13–15 or 16–17, and never any under-13 group |
| Could the store listing unintentionally appeal to children? | No. Photos of buildings and food, plain text, no cartoon characters, no games |
| Is the app designed for children? | No |

Why 18+:

- MOVO is for flat owners, tenants and committee members: maintenance dues, society accounts, roles and committee decisions. These are adult responsibilities; the privacy policy already says MOVO is "not directed at children under 18".
- If any under-13 age group is selected, the app falls under Google Play's **Families policy**: extra requirements for ads SDKs (Families self-certified only), data collection limits (no device identifiers such as the push token for children without care), COPPA / GDPR-K style disclosures, possible "Teacher Approved" review, and stricter review of user-to-user interaction. The app does not need any of that and would have to change to comply.
- Selecting 13–17 also triggers extra review for apps with user interaction and adds "Families"-style questions. 18+ only keeps the app out of those programmes and matches India's DPDP Act, which requires verifiable parental consent for anyone under 18.

## 6. Other App content forms

| Form | Answer |
| --- | --- |
| News app | No |
| Government app | No |
| Financial features | My app does not provide any financial features (it records maintenance payments made outside the app; no payments, loans, wallets, trading) |
| Health apps | No health features |
| COVID-19 contact tracing / status | No |
| Data safety | Section 7 |
| Account deletion | In-app: Me → Delete my account. Web: `https://tejas96.github.io/movo/delete-account.html` |
| Advertising ID | No (no ads or analytics SDK). Before answering, confirm the merged release manifest has no `com.google.android.gms.permission.AD_ID` (`apps/mobile/android/app/build/intermediates/merged_manifests/release/...`) |
| Photo and video permissions | Not applicable: the app uses the system photo picker and does not request `READ_MEDIA_IMAGES` |

## 7. Data safety

General answers (from `docs/08-release-and-ops.md`):

- Does the app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS only)
- Do you provide a way for users to request that their data is deleted? **Yes** (in app and on the web page)
- Shared with third parties: **No** for every type (hosting, Firebase Cloud Messaging and Resend are service providers acting for us, which Play does not count as sharing; data one user sends to another user in the app, e.g. an emergency alert with name and phone, is user-initiated and also not "sharing").
- No data is used for advertising, marketing, analytics or fraud prevention beyond what is listed.

### Table as in docs/08

| Data type (Play category) | Collected | Purpose | Optional |
| --- | --- | --- | --- |
| Name (Personal info) | Yes | App functionality, Account management | No |
| Email address (Personal info) | Yes | Account management (reset links), App functionality | Yes |
| Phone number (Personal info) | Yes | Account management (sign in), App functionality | Yes (email alone also works) |
| Address: flat and wing (Personal info → Address) | Yes | App functionality | No |
| Other info: vehicle numbers, society role (Personal info → Other) | Yes | App functionality | Yes |
| Photos (market listing photos the user picks) | Yes | App functionality | Yes |
| Purchase history: maintenance payments recorded by the committee (Financial info → Purchase history) | Yes | App functionality | No |
| Other user-generated content: notices, minutes, tasks, RSVPs, market listings and reviews (App activity → Other user-generated content) | Yes | App functionality | Yes |
| In-app messages between buyer and seller on a market order (Messages → Other in-app messages) | Yes | App functionality | Yes |
| Device or other IDs: push token | Yes | App functionality (notifications) | No |
| Crash logs / diagnostics | No (server logs only, not collected from the device) | – | – |
| Location, contacts, SMS, call logs, web history, health, files | No | – | – |

### Checked against the code: mismatches and gaps

| # | Row | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| 1 | Phone number "Optional: No" | Sign-up accepts phone **or** email; `User.phone` is nullable, so a user can have no phone | `packages/contracts/src/auth/auth.contract.ts:46`, `apps/api/prisma/schema.prisma:396` | Mark phone **Optional: Yes** (email is already optional). Both stay "Account management, App functionality" |
| 2 | Photos: "profile photo" | No profile photo upload exists yet. `avatarUrl` is only ever set to null, and the only file kind is `LISTING_IMAGE`. Listing photos come from the system gallery picker; the camera is never used for uploads | `apps/api/src/modules/identity/auth.service.ts:249`, `schema.prisma:304-306`, `apps/mobile/src/features/market/PhotoPickerRow.tsx:43` | Row stays "Photos: Yes, optional" but describe it as Market listing photos only. `site/privacy.html` also lists "profile photo (optional)"; fine as future-proof, or remove it until avatars exist |
| 3 | Device or other IDs | Correct, and it also stores platform and app version with the FCM token. The Firebase SDK also creates a Firebase installation ID for FCM. Refresh sessions store IP, platform and device name; the audit log stores IP | `apps/mobile/src/core/push/push.ts:51-66`, `schema.prisma:433-465`, `apps/api/src/common/audit/audit.service.ts:36` | Keep "Device or other IDs: Yes, App functionality" and add **Fraud prevention, security and compliance** as a purpose (sessions and audit IPs are for security) |
| 4 | Crash logs / diagnostics "No" | Correct: no Sentry, Crashlytics, Analytics or ads SDK; `apps/mobile/firebase.json` turns off Firebase data collection and analytics auto-collection | `apps/mobile/package.json`, `apps/mobile/firebase.json` | No change. Recheck if Crashlytics is ever added |
| 5 | Purchase history | Correct. Payments hold amount, date, method (e.g. UPI), reference and notes, entered by the committee. The society's own UPI ID / bank details (`PaymentInstruction`) are society data, not the user's | `schema.prisma:1079-1105, 1134` | Optional: Play's "Other financial info" also fits a maintenance ledger; "Purchase history" is acceptable. Keep one, not both |
| 6 | User-generated content | Correct, but more kinds exist than listed: emergency alert messages, listing reports, vendor suggestions, expenses entered by committee members. "Minutes" are not built yet (meetings have short updates) | `schema.prisma:847, 885, 1527` | Description only; the Play category is the same |
| 7 | Messages | Correct: `OrderMessage` is the only user-to-user messaging | `schema.prisma:1496` | No change |
| 8 | Other personal info | Also stored: preferred language (`User.locale`) and vendor phone numbers members enter about third parties | `schema.prisma:398, 852` | Language needs no separate row (App functionality). Vendor numbers are not the user's data |
| 9 | Location "No" | Correct. Meeting/event "location" is free text; alerts have no coordinates | `schema.prisma:885-906` | No change |
| 10 | Permissions | App: INTERNET, POST_NOTIFICATIONS. Firebase adds WAKE_LOCK, ACCESS_NETWORK_STATE. `react-native-keychain` adds USE_BIOMETRIC / USE_FINGERPRINT. **The AR module adds CAMERA** (live AR view only, nothing uploaded, so not "collected") | `packages/ar-native/android/src/main/AndroidManifest.xml:2` | No Data safety row needed for a live camera preview (processed on the device, never sent off it, so not "collected"). **Decided 2026-10-06: the AR guide ships in build 1**; `site/privacy.html` section 2 now has the camera paragraph |

Directory privacy claim in the listing is backed: `privacyShowPhone` and `privacyShowEmail` default to false (`schema.prisma:607-608`), edited in `features/me/PrivacyScreen.tsx`; Market `showPhoneAfterAccept` defaults to false (`schema.prisma:1434`).
