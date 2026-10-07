# MVP roadmap

No dates. Milestones in build order. Each one is usable on its own.

## Phases

| Phase | Goal | Scope |
| --- | --- | --- |
| 0 Foundation | the skeleton works end to end | monorepo, design system primitives, contracts, i18n, API with auth, tenancy, memberships, config, notifications outbox, documents, audit, CI, Docker deploy |
| 1 Core MVP | society #1 uses it daily | Home, Notices, Meetings, Events, Directory, Parking, Services, Emergency, Duties, Tasks, Rewards ledger, Maintenance, Expenses, receipts, Manage society |
| 1.5 Community | more reasons to open the app | Marketplace and buy-and-sell (society-only first), point redemption against dues, join requests polish, RLS hardening, receipt PDF |
| 2 Platform | second and third societies | web admin, marketplace network and nearby, in-app chat, meeting minutes and attendance, multilingual content fields, OTP or social login, payment gateway, complaints, visitors |
| 3 Smart society | physical automation | edge gateway, water monitoring, gate schedule and status, lights, CCTV events, energy insights |

Your section 33 listed marketplace and buy-and-sell as MVP candidates. I put them in 1.5 so the first release is small. See decision 1 in `00-decisions-needed.md`.

## Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| M0 ✅ | Repo and design system | apps scaffolded, `pnpm lint typecheck` green, Android debug build runs, primitives built |
| M1 ✅ | Auth and identity | register, login, refresh, logout, reset by email link and admin code, account deletion, rate limits, tests |
| M2 ✅ | Tenancy | platform admin creates a society, buildings, flats; roles seeded; invite by code; join request; `GET /me/context`; society switcher; cross-tenant test suite |
| M3 ✅ | Home shell and notices | Home summary endpoint, attention list, notification center, push outbox (transport is a no-op until Firebase exists), notices with audience and pins |
| M4 ✅ | Directory, services, parking, emergency | privacy-aware directory, vendors, my parking, emergency contacts and alerts |
| M5 ✅ | Meetings and events | schedule, reminders, RSVP, Home upcoming |
| M6 ✅ | Money | billing plans, bill generation, late fees, record payment with idempotency, receipts, collection status, how to pay, reminders |
| M7 ✅ | Expenses and reports | expenses with receipts and approval, categories, FY summary, member visibility setting |
| M8 ✅ | Duties, tasks, rewards | rotation engine, assignments and overrides, tasks with volunteering and verification, points ledger, rules |
| M9 ✅ | Manage society and release | all admin screens, audit log view, Hindi and Marathi complete, privacy policy page, Play internal testing, backups and uptime checks live |
| M10 ✅ | Marketplace (1.5) | listings, orders, messages, reviews, moderation, network visibility flag |

## Done so far (2026-09-26)

M0 to M10 are built and tested. The app runs on Android against the local API. See `07-dev-setup.md`.

M4 added: Services (vendor categories, vendors, member suggestions the committee approves), Parking (slots, one active allocation per slot, vehicles per flat, member detail shows vehicles by the `directory.showVehicles` setting), Emergency (contacts with India's public numbers seeded, hold-to-confirm alerts, cooldown, push to the society or configured roles, resolve or false alarm, active alerts first on Home), and a wing filter in the directory.

M5 added: Meetings (schedule, edit, reschedule with a history, short updates, cancel, mark as held; reminders by the `meetings.reminderHoursBefore` setting, 24 h and 1 h by default), Events (publish, edit, cancel, RSVP going / maybe / can't go with up to 10 guests, organisers see who answered; one reminder a day before, skipped for members who said they can't go), a reminder job every 5 minutes with a `ReminderSent` ledger so nothing goes twice, Home "Upcoming" (next two meetings or events within 14 days), and a pure-JS date and time picker (`DateTimeSheet`) in the design system. Audience pickers stay "everyone" in the app for now; the API already accepts roles, wings and flats.

M6 added: billing plans (monthly, quarterly, half-yearly, yearly; same amount per flat or per sq ft; a different amount for chosen flats; late fee fixed, percent or per day with grace days and a cap), bills made nightly at 00:30 IST or on demand and never twice for the same plan, flat and period, one-off bills, late fees nightly at 01:00, dues reminders at 09:00 (3 days before, on the day, weekly while overdue, 4 times at most), record payment with an idempotency key and a receipt number per financial year (R-2026-27-0001), oldest bill first or chosen bills, advance kept and used on the next bill, reverse (the recorder for 10 minutes, then `maintenance.waive`), waive a bill or a late fee, "How to pay" with a UPI pay link, collection status by the transparency setting, and dues on Home. Receipt photos wait for document upload.

Also fixed in M6: text sizes. `cn()` used tailwind-merge, which took `text-h1`, `text-display` and the rest for colours and dropped them, so every text rendered at one size. The MOVO scale is now registered with tailwind-merge.

M7 added: expenses (category, amount, date, payee, method, reference) with approval by the `expenses.approval` setting (never, above an amount, always; ₹5,000 by default) and never by the person who added them, reject with a reason, edit sends it back, remove while not approved, idempotency keys; ten seeded expense categories the committee can rename or extend; other income (donations, interest, hall booking, fines); a financial-year report with income, spending by category and month, balance, pending approvals and unpaid dues; the `expenses.visibleToMembers` setting (none, summary, details); "expenses to approve" on Home. Receipt photos wait for document upload.

M8 added: duties (rotations over flats or members, daily, weekly or monthly; 12 turns planned ahead; an hourly job starts and ends turns, marks unconfirmed ones missed or carries them over, and reminds 2 days before the end; members mark their turn done; the committee skips, reassigns, completes, reorders, pauses and ends), tasks (assigned or open for volunteers, give back, mark done with a note, accepted or sent back by someone else, cancel), and rewards (append-only points ledger, points for accepted tasks and optionally for duties, `rewards.maxPointsPerMonth` cap, adjustments, a leaderboard by the `rewards.leaderboard` setting). Home shows my duty, my tasks, tasks to check and "My contribution". Point redemption against dues stays in 1.5. Task photos wait for document upload.

Also fixed in M8: scrolled content no longer slides under the status bar.

M9 added: Manage society as a tile grid shown by permission (members, invites, requests, wings and flats, parking slots, society profile, modules, roles, audit log); society profile (name, address, default language, financial year start, join requests on or off); modules on or off with a settings page for each module; roles (add, rename, change permissions, delete unused custom roles; the admin role keeps every permission; nobody gives or removes a permission they do not hold); member page with several roles, flats and relation, and a confirm before suspend or remove; audit log by area with who, when and what changed; privacy policy link on Me and at sign-up; Hindi and Marathi complete; API Docker image, production compose with Caddy, nightly backups with a restore script, uptime checks, deploy workflow, Play release build and the privacy page on GitHub Pages. See `08-release-and-ops.md`.

M10 added: the Market. Members sell homemade food, products, services and used items to neighbours. Food has a veg, egg or non-veg mark, a ready time and an order-by time, pickup or delivery at the door, and a portion limit that goes down when the seller accepts. Up to 5 photos per listing, uploaded from the phone gallery and stored on the server's disk behind signed urls. Orders go requested → accepted → ready → completed, with decline and cancel, a short message thread, and a review from the buyer. Flats and the seller's phone (if shared) appear only after acceptance. Members report listings; moderators hide them, which cancels open orders. The committee can switch off food or resale, and store a "nearby societies" flag for later. Home shows new orders waiting for the seller. Nothing is paid in the app.

Photos (October 2026): profile photo, society photo, bill photos on expenses, proof of payment on receipts and photos when a task is marked done, each from the camera or the gallery. Photos move from the server disk to a private Oracle Object Storage bucket behind `FileStore` (rustfs locally); signed links stay a day so phones cache them. Notice attachments and event covers come later.

## Next

1. Follow the runbook in `08-release-and-ops.md`: Oracle Always Free VM in Mumbai (upgraded to Pay As You Go, still ₹0), DuckDNS or a bought domain, healthchecks.io for the API and backup heartbeats, off-site backups to Oracle Object Storage or R2; deploy, then send the AAB to Play internal testing.
2. Firebase project for push (the FCM transport is built; until `FIREBASE_SERVICE_ACCOUNT_JSON` is set it logs instead of sending). Steps: `08-release-and-ops.md`, "Firebase (push)".
3. Phase 1.5 leftovers: points against dues, join request polish, row-level security, receipt PDF. Browsing nearby societies' listings comes with the network in phase 2.

## Explicitly out of the MVP

Payment gateway, SMS or OTP, chat, web admin, accounting ledgers beyond bills and expenses, visitor management, complaint tickets, asset registers, any hardware integration, analytics dashboards, dark theme, iOS store release.
