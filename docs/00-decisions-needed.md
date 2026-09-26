# Decisions

**Status (2026-09-26): you chose option A for every question below.** They are now decisions, kept here as the record. Section B still needs your answers before society #1 goes live.

## A. Decided (option A everywhere)

### 1. When do we build the marketplace? — DECIDED: A
- **A. After the core is live with society #1** (recommended). Marketplace is the biggest screen surface and the least "society management" value. Building it second keeps the first release small and calm.
- **B. In the first release.** Adds about 30% more screens and moderation work before anyone uses the app.

Either way the data model and tenancy rules for it are in the plan now.

### 2. Where does the server run? — DECIDED: A
- **A. Oracle Cloud "Always Free" ARM VM in Mumbai, Docker Compose** (recommended). ₹0 per month. Needs a card at signup. Upgrade the account to pay-as-you-go so Oracle does not reclaim idle free machines. Free limits still cost ₹0.
- **B. Small paid VPS (Hetzner or DigitalOcean)**, about ₹450–600 per month. Simpler signup, no reclaim risk.

Both run the same `docker compose` file. Moving later is one evening of work.

### 3. Password reset without OTP or SMS — DECIDED: A (built)
- **A. Email link through a free email tier (Resend, 3,000 emails per month) plus an admin-issued one-time reset code for members who have no email** (recommended). Admins already know their residents in person.
- **B. Admin-issued reset code only.** Zero external services. Slightly more work for admins.

### 4. Brand look — DECIDED
You chose the white, gray and black style of screenshot 1 (real estate app), with its Poppins font and Iconsax icons. The design system and preview now match it. Nothing to decide here.

### 5. How residents install the Android app — DECIDED: A
- **A. Google Play Console, $25 one-time** (recommended). Start on the internal testing track, then production. Residents get automatic updates and no scary install warnings.
- **B. Share the APK file directly.** Free, but Android shows security warnings and there are no automatic updates.

### 6. Privacy defaults for every society (admins can change them) — DECIDED: A (built)
- **A. Directory shows name, photo, flat, role. Phone and email hidden unless the member opts in. Collection view shows Paid / Pending per flat without amounts.** (recommended)
- **B. Stricter: no per-flat collection status at all by default.** Members see only society totals.

### 7. Do rotation duties earn reward points? — DECIDED: A (default in settings schema)
- **A. Off by default. Only tasks earn points.** (recommended). Duties are a shared obligation, not a contribution.
- **B. On by default.** Each confirmed duty period earns configured points.

## B. Facts I need about society #1 (OPEN)

I can build without these, but the seed data and the first demo will use placeholders until you answer.

1. Society name, city, and whether it is one building or several wings.
2. Number of flats and how they are numbered (for example A-101 or 101).
3. Who the first admins are (name plus phone or email).
4. Maintenance rule: same amount for every flat, or by area or flat type? Amount? Monthly or quarterly? Due day? Any late fee?
5. Financial year start month. I assumed April.
6. Parking: number of slots, two-wheeler and four-wheeler split, whether slots have numbers.
7. UPI ID or bank details to show under "How to pay".
8. Existing trusted vendors (name, category, phone) if you want them seeded.
9. Committee roles you actually use (chairman, secretary, treasurer, members).
10. Default language for notifications when a member has not chosen one.

## C. Assumptions I made (say so if any is wrong)

- Time zone is Asia/Kolkata. Currency is INR only. Money is stored in paise as integers.
- Admin-written content (notices, agendas) is single-language in v1. Multilingual fields come later.
- Notices are published by committee roles only. Residents do not post in v1.
- No chat in v1. Marketplace uses a simple message list on an order, no realtime.
- Light theme only in v1. Dark tokens exist and are unused.
- iOS builds run on the simulator only until an Apple developer account exists.
- The app will include "Delete my account". Google Play requires it for apps with sign-up.
- A privacy policy page is required by Play. It can be hosted free on GitHub Pages.
- Firebase is used only for push (FCM). Everything else is our own backend.
