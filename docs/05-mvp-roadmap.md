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
| M4 | Directory, services, parking, emergency | privacy-aware directory, vendors, my parking, emergency contacts and alerts |
| M5 | Meetings and events | schedule, reminders, RSVP, Home upcoming |
| M6 | Money | billing plans, bill generation, late fees, record payment with idempotency, receipts, collection status, how to pay, reminders |
| M7 | Expenses and reports | expenses with receipts and approval, categories, FY summary, member visibility setting |
| M8 | Duties, tasks, rewards | rotation engine, assignments and overrides, tasks with volunteering and verification, points ledger, rules |
| M9 | Manage society and release | all admin screens, audit log view, Hindi and Marathi complete, privacy policy page, Play internal testing, backups and uptime checks live |
| M10 | Marketplace (1.5) | listings, orders, messages, reviews, moderation, network visibility flag |

## Done so far (2026-09-26)

M0 to M3 are built and tested. The app runs on Android against the local API. See `07-dev-setup.md`.

## Next

1. M4: directory polish, vendors ("Services"), parking, emergency contacts and alerts.
2. M5: meetings and events with reminders.
3. M6: money — billing plans, bills, manual payments, receipts, collection view.
4. iOS pod install and simulator run, Firebase project for push, GitHub repo and CI.

## Explicitly out of the MVP

Payment gateway, SMS or OTP, chat, web admin, accounting ledgers beyond bills and expenses, visitor management, complaint tickets, asset registers, any hardware integration, analytics dashboards, dark theme, iOS store release.
