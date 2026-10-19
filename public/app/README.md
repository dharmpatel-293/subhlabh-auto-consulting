# AutoLedger — Used-Car Partnership Management

A responsive starter web app for a used-car partnership business, built with HTML, CSS, JavaScript, Bootstrap 5, and Supabase.

## Included in this starter

- Email/password sign-in and password-reset flow
- Shared business workspace lookup
- Responsive dashboard and vehicle inventory
- Add/edit car records, with purchase price and Jitendra/Pratik contributions captured when a new car is added
- Password re-verification before deleting a car; deletes the car and its related financial records in one database transaction
- Record purchase/repair/other costs with separate contributions from both partners
- Record sale price and date
- Profit-sharing interface supporting percentage and fixed rupee amount modes
- English/Gujarati interface dictionaries
- CSV export
- Supabase SQL schema and initial Row Level Security policies

## Before running

1. Create a Supabase project.
2. Open `supabase/schema.sql`, review it, and run it in the SQL Editor of a new development project.
3. In Supabase Authentication, create two user accounts for the two partners.
4. Create one business row, two profile rows, and two business membership rows. Do this through a trusted administrator/setup process; don't open public self-registration or let users assign themselves a business role.
5. Put your Supabase project URL and publishable key in `js/config.js`.
6. Serve the folder through a local development server (for example VS Code Live Server). Do not open `index.html` directly as a `file://` URL.
7. Sign in with one of the accounts.

## Configure `js/config.js`

```js
window.APP_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabasePublishableKey: "YOUR_PUBLISHABLE_KEY"
};
```

Never put a `service_role` key or other secret key in frontend JavaScript.

## Important limitations — do not use as production accounting yet

This is an initial development scaffold, not a finished or audited accounting system.

- The cost form now records both partners' contributions and validates that their amounts add up to the total cost. This is client-side validation in the starter; enforce the same rule server-side before production.
- The initial profit allocation table stores percentages. The UI's fixed-amount option converts the agreed amounts to equivalent percentages. For production, store `share_method` and the agreed fixed amounts explicitly, preserve the agreement snapshot, and calculate the allocation with a database transaction.
- The initial example RLS policies are not a complete production security review. Add cross-table business-ID validation, secure business/member provisioning, admin-only membership changes, audited deletion/soft-delete, and restrict deletion of financial history.
- The schema's two-member assumptions should be enforced server-side. Allocation validation must handle rounding and negative profit/loss explicitly.
- The current dashboard computes profit from recorded costs and sales, but does not yet include full settlement accounting, split contributions, receipt uploads, or audit-log UI.
- Test restore from backups before entering real financial data. Free plans may pause and may not provide automatic backups.
- Review the current hosting provider's terms before using a free plan for a commercial business.

## Apply the profile visibility patch

Because your existing database is already set up, **do not rerun `supabase/schema.sql`**. Run `supabase/profile_visibility_patch.sql` once in the Supabase SQL Editor. It lets each signed-in business partner read the names of the other members of their own shared workspace; it does not expose profiles outside the workspace.

## Suggested next build steps

1. Finish secure business provisioning and profile creation.
2. Implement split-funded costs and atomic transaction saving.
3. Add explicit percentage/fixed-amount agreements and loss-sharing rules.
4. Add settlements, audit logs, soft deletion, and backup/restore process.
5. Add receipts/photos in a private Supabase Storage bucket with RLS.
6. Test access with two accounts and verify that unrelated users cannot access the business.


## Apply the car deletion patch

Run `supabase/car_delete_password_patch.sql` once in the existing Supabase SQL Editor. Do not rerun `schema.sql`. When deleting a car, the app asks for the signed-in user's current password and verifies it with Supabase Auth before invoking the database function. The delete confirmation explains that the car's costs, contributions, sale, profit allocation, and linked settlements are permanently deleted.

## Purchase price and partner labels

When adding a new car, enter the purchase price and the amounts funded by Jitendra and Pratik. The two contributions must total the purchase price. The app records the purchase as a cost and saves the partner contributions automatically. The partner labels use the business membership ordering (earliest joined membership first); verify that the first membership belongs to Jitendra and the second to Pratik before entering real records. Editing an existing car does not change its original purchase-cost entry; use Transactions to add a correction if required.
