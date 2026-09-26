# Roles and permissions

## 1. Model in one paragraph

Permissions are fixed keys defined in code. Roles are per-society bundles of permission keys, seeded from templates and editable by admins. A membership holds one or more roles. Permissions are the union. Owner and tenant are not roles. They are `flat_occupancy.relation`, a fact about a flat. The backend checks permissions on every route. The app only hides what the user cannot do.

## 2. Permission catalog

| Key | Meaning |
| --- | --- |
| `society.settings.manage` | society profile, modules, settings, notification policies |
| `society.structure.manage` | buildings, flats |
| `society.roles.manage` | create roles, edit permissions, assign roles |
| `member.manage` | invite, approve join requests, edit, suspend, remove, assign flats, issue reset codes |
| `member.view_contact` | see phone and email regardless of member privacy |
| `parking.manage` | slots, allocations, vehicles of any flat |
| `notice.publish` | create and publish notices, pin |
| `notice.manage_all` | edit or archive notices by others |
| `meeting.manage` | create, edit, cancel, complete meetings |
| `event.manage` | create, edit, cancel events |
| `task.manage` | create, assign, edit, cancel tasks; categories and points |
| `task.verify` | verify submitted tasks (awards points) |
| `duty.manage` | create rotations, participants, pause |
| `duty.override` | skip, swap, force-complete a period |
| `reward.settings.manage` | reward rules |
| `reward.adjust` | manual point adjustments |
| `reward.redeem_approve` | approve redemptions |
| `maintenance.settings.manage` | billing plans, late fees, payment instructions, transparency |
| `maintenance.generate_bills` | generate or regenerate bills, ad hoc bills |
| `maintenance.record_payment` | record, allocate, reverse payments |
| `maintenance.waive` | waive bills or late fees |
| `maintenance.view_all` | see every flat's bills and balances with amounts |
| `expense.create` | add expenses |
| `expense.approve` | approve or reject expenses |
| `expense.manage_categories` | categories |
| `finance.reports.view` | FY summaries, category totals |
| `vendor.manage` | vendors and categories |
| `emergency.contacts.manage` | emergency contacts |
| `emergency.alert.resolve` | resolve or mark false alarm |
| `marketplace.moderate` | hide listings, handle reports |
| `marketplace.settings.manage` | visibility and network participation |
| `audit.view` | read the audit log |

Every ACTIVE member implicitly can: view the directory (with privacy applied), view notices, meetings, events, vendors, emergency contacts, their own flats, parking, bills, payments, points, tasks; volunteer for open tasks; confirm their own duty; raise an emergency alert; RSVP; sell and buy in the marketplace when enabled; manage their own profile, privacy, and notification preferences. These are not permission keys. They are membership.

## 3. Role templates (seeded per society, editable)

| Permission | Admin | Committee | Treasurer | Resident | Staff |
| --- | :-: | :-: | :-: | :-: | :-: |
| society.settings.manage | ✓ | | | | |
| society.structure.manage | ✓ | | | | |
| society.roles.manage | ✓ | | | | |
| member.manage | ✓ | | | | |
| member.view_contact | ✓ | ✓ | ✓ | | ✓ |
| parking.manage | ✓ | ✓ | | | |
| notice.publish | ✓ | ✓ | | | |
| notice.manage_all | ✓ | | | | |
| meeting.manage | ✓ | ✓ | | | |
| event.manage | ✓ | ✓ | | | |
| task.manage | ✓ | ✓ | | | |
| task.verify | ✓ | ✓ | | | |
| duty.manage | ✓ | ✓ | | | |
| duty.override | ✓ | ✓ | | | |
| reward.settings.manage | ✓ | | | | |
| reward.adjust | ✓ | | ✓ | | |
| reward.redeem_approve | ✓ | | ✓ | | |
| maintenance.settings.manage | ✓ | | ✓ | | |
| maintenance.generate_bills | ✓ | | ✓ | | |
| maintenance.record_payment | ✓ | | ✓ | | |
| maintenance.waive | ✓ | | ✓ | | |
| maintenance.view_all | ✓ | ✓ | ✓ | | |
| expense.create | ✓ | ✓ | ✓ | | |
| expense.approve | ✓ | ✓ | ✓ | | |
| expense.manage_categories | ✓ | | ✓ | | |
| finance.reports.view | ✓ | ✓ | ✓ | | |
| vendor.manage | ✓ | ✓ | | | |
| emergency.contacts.manage | ✓ | ✓ | | | |
| emergency.alert.resolve | ✓ | ✓ | | | ✓ |
| marketplace.moderate | ✓ | ✓ | | | |
| marketplace.settings.manage | ✓ | | | | |
| audit.view | ✓ | | ✓ | | |

Staff is a membership without a flat. Staff do not appear in the resident directory by default.

## 4. Rules the backend enforces

1. A route declares its module and required permission in the contract. Guards read both.
2. Nobody can grant a permission they do not hold themselves. This covers adding or removing a permission on a role, and giving a member a role.
3. The last member holding `society.roles.manage` cannot remove that role from themselves. In practice: the admin role always has every permission and the society keeps at least one active admin.
   Built-in roles cannot be deleted. A custom role can be deleted only when no member or invite uses it (`ROLE_IN_USE`).
4. The creator of an expense cannot approve it. A payment cannot be reversed by its recorder without `maintenance.waive` unless within 10 minutes (typo window). Both are configurable.
5. `maintenance.view_all` shows amounts. Without it, a member sees the collection view only if the society's transparency setting allows, and never other flats' amounts unless the setting says so.
6. Privacy is applied inside the directory query. `member.view_contact` bypasses it. The app never receives hidden fields.
7. Platform admins act only on `/v1/platform/*` routes. They have no implicit access to society data.

## 5. Configuration that changes visibility (not permissions)

| Setting | Values | Default |
| --- | --- | --- |
| `maintenance.transparency` | `OFF`, `STATUS`, `STATUS_AND_AMOUNT` | `STATUS` |
| `expenses.visibleToMembers` | `NONE`, `SUMMARY`, `DETAILED` | `SUMMARY` |
| `rewards.leaderboard` | `OFF`, `TOP_5`, `ALL` | `OFF` |
| `directory.allowPhoneOptIn` | boolean | true |
| `directory.showVehicles` | `OFF`, `ADMINS`, `ALL` | `ADMINS` |
| `tenancy.joinRequests` | `OFF`, `APPROVAL` | `APPROVAL` |
| `emergency.alertRecipients` | `ALL`, `ROLES` + role ids | `ALL` |
| `marketplace.network` | boolean | false |
