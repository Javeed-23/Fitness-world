# FitnessWorld: full project with backend

The FitnessWorld app (workouts, recovery, video library, meal plan, progress, social, gym groups, marketplace) with a Node/Express/SQLite backend. The backend handles sign-up, login, sessions and password reset, and stores each account’s app data on the server, so it follows the account across browsers and devices. `public/styles.css` is byte-identical to the original prototype.

## Run
1. `npm install` (Node 20+)
2. Copy `.env.example` to `.env`; set `SESSION_SECRET` to 32+ random characters
3. `npm run dev`, then open http://localhost:3000 and create an account
4. `npm test` runs the backend tests (starts its own server on a temporary database)

## Layout
- `public/` shown to visitors: `login.html`, `register.html`, `forgot-password.html`, `reset-password.html`, `auth.css`, `auth.js`, `styles.css`
- `private/` only served to a logged-in session: `index.html` and the app scripts, loaded in this order: `app.js`, `features.js`, `plans.js`, `meals.js`, `groups.js`, `rig.js`, `motion.js`, `video.js`, `today.js`, `progress.js`
- `server.js`: Express routes, sessions, SQLite (`better-sqlite3`), account data API. `tests/api.test.js`: backend tests. `data/` (created at first run): the SQLite database and session store, not part of the project files

## What works (tested)
- Register, login, logout; bcrypt (cost 12) password hashes, never sent to the browser
- HttpOnly server-side session (SQLite store), session regenerated on login/register, `Secure` cookie in production
- Server-side validation (separate from the browser-side checks in `auth.js`): name, email, password 10-128 chars with a letter and a number, matching confirmation
- Anonymous requests to `/`, `/app.js`, `/session.js` redirect to `/login`; data APIs return 401; protected pages are `no-store`, so Back after logout doesn't show the dashboard
- Login rate limit (10 failed tries / 15 min / IP), identical error for unknown email vs wrong password, cross-site Origin check and JSON-only POSTs
- Password reset tokens: random, stored hashed, 1 hour, single use; a reset signs out all existing sessions
- Account data API (`GET`/`PUT /api/me/data`): one versioned document per account, login required, only the app’s own keys are stored, 1 MB request limit (900 KB stored), a save based on an old version gets 409 instead of overwriting, bad input gets a 4xx instead of a 500, cross-site saves are refused
- Header status shows “Saving…”, “Saved to your account”, or “Saved on this device, will retry” when the server cannot be reached
- Tests: `npm test` runs 10 backend checks. In a browser, the full app was checked end to end: all screens, the video viewer, the meal plan (22 checks), and sync across browsers, stale windows, quick reloads and clearing data (7 checks)

## Not done / limits
- **Password-reset email is untested** against a real mail server. Set `SMTP_*` in `.env`; with no SMTP the page says email isn't set up instead of pretending to send.
- **No email verification.** After registering, the user goes straight to the dashboard.
- **Sync is last-save-wins with a version check, not a merge.** Edits made offline are kept in the browser and sent when the connection returns. If another window or device saved first, the server’s newer copy wins and the unsent change is discarded, with a message saying so. Two windows editing the same data at the same moment will therefore lose one edit; a field-level merge would be the next step.
- Social feed, gym groups and marketplace data are saved per account, as part of the account data. They are not shared between users yet. The starter’s `/api/posts`, `/api/groups` and `/api/marketplace` routes exist (login required) but the UI does not call them; a shared feed needs a product decision first.
- No demo data: no demo users, sample posts, sample challenges or sample shop items. Sample items that older versions saved into an account are removed when the app loads.
- Not production-ready: add HTTPS, a managed DB, email verification, and a payment gateway before real use.

## Changes to existing files
- `index.html`: added a "Log out" button (existing `btn-quiet` style) under "Export demo data"; loads `/session.js`; two sentences in Settings that said "not real authentication" / "no secure accounts" were updated to stay true
- `app.js`: storage key includes the user id, default display name is the account name, logout handler, one confirm message reworded; account sync (save, load, version check, conflict handling, send-on-leave)
- `server.js`: `user_data` table, `GET`/`PUT /api/me/data`, a 1 MB JSON limit for that route only, and client errors (bad JSON, too large) keep their 4xx status
- `index.html`: the header badge is now the sync status
- `meals.js`, `progress.js`: see the sections above

## In-app features (public/features.js, loaded after app.js)
Dashboard: last-7-days chart and weekly workout goal. Workout: rest timer. Social Feed: comments and delete your own posts. Marketplace: cart with quantities and a demo checkout. All stored in the browser (per account), no real payments.

## Profile points and plans (public/plans.js, loaded after features.js)
- Sign-up asks for a fitness goal (lose fat / build muscle / stay fit / improve endurance), stored on the account and validated by the server.
- Profile: Member Points (name, points, rank, streak) and Gym Points (points, rank, next rank).
- Workout tabs: Today, Workout, My workouts, Workout plan (4 weeks, assigned by goal as muscle plans with progressive sets/reps), Meal plan (see below). For each muscle all variations are listed and the user selects up to a limit (e.g. up to 5 for chest). Each exercise has steps and a YouTube search link.
- Adults 18-80 only. General guidance, not medical advice.

## Gym groups, plans and fees (public/groups.js, loaded after plans.js)
- Creating a group (Gym → Groups) asks for confirmation of a demo ₹50 payment, then starts a 7-day Gym Pro trial. Nothing is ever charged automatically; choosing Gym Beginner (₹199) or Gym Pro (₹499) asks for explicit confirmation.
- Challenge credits: Beginner 2 + 2 per month (days 1-15 and 16-end), Pro 5 + 5, trial 2 in total (trial credits are separate from plan credits). Creating a challenge uses 1 credit; Local and District only, no cash prizes.
- Payment records: group creation and subscriptions have no platform fee; marketplace sales carry 5% (Beginner) or 1% (Pro/trial) and show the seller's share.
- Demo only, stored in the browser. One group per account. Real payments and server-side storage are not built yet.

## Today tab, workout environments, progress (public/today.js, public/progress.js; plans.js updated)
- Workout → Today, top to bottom: today's workout with Start workout (timer, tick each exercise, Finish saves to My workouts), then the Recovery check-in with the last three check-ins, then the exercise video library. Each exercise row has a "▶ 3D" button that opens it in the viewer below. Weeks advance automatically from the day the plan started.
- Accounts with no goal stored get a goal chooser on Today and in the Workout plan.
- Workout plan asks where you train (Gym, Calisthenics, Home with dumbbells, Home without equipment) and lists only the matching variations, each with steps and a video link (a YouTube search). Pick up to the limit per muscle.
- My Progress: weight/waist change, workouts, streak, and body fat (see Meal plan for the shared body numbers). Neck (and hips for women) are logged with each measurement.
- Log out: sidebar button and Security & Settings → Account.

## Exercise video library (public/video.js, public/rig.js, public/motion.js)
- Every variation in the plans library (105 in total) is listed under Today, with search and a muscle filter. One shared viewer plays the selected one.
- Three views, all showing the same movement: **Mannequin** (shaded figure in training clothes), **Skeleton** (bones and joints), and **Muscle** (the muscles the exercise works are highlighted).
- 360°: drag the figure to turn it, use the Turn slider, the Front/Side/Back buttons, or Auto-turn. Play/Pause, Restart and 0.5×/1×/1.5× speed.
- The animation is procedural: `motion.js` maps each variation to a posture (floor, plank, bench, bar, seat, and so on) and to one of 77 movement patterns, and `rig.js` grounds the figure so it rests on the floor, bench or bar. It is a learning aid for form, not motion-capture footage. Some uncommon variations are approximations, and the viewer shows a simplified figure, not real video.
- three.js r128 (MIT licence, `public/vendor/three.min.js`) is served from this app, because the content security policy only allows scripts from the same origin. It is loaded the first time the viewer comes into view.
- Checks: `rig.js` and `motion.js` were tested numerically (every variation grounded, no NaNs, the figure stays on the spin axis at every angle) and visually (a contact sheet of all 105 variations at two keyframes). The end-to-end run covered the tabs, the list, search and filters, view switching, play/speed, drag-to-turn, the Today links, the recovery check-in, the workout session, body fat, and the console (no errors).

## Meal plan (public/meals.js, its own tab under Workout)
- Details: sex, age, height, weight, optional body fat % and waist, activity level, and food preference (vegetarian or non-vegetarian). Weight and body fat come from your latest measurement when you have one. Body fat you enter yourself takes priority over the measured estimate.
- Body fat is measured with the US Navy method from your latest waist and neck (hips for women), or entered directly. Progress shows the same value.
- Calories: with body fat known, the BMR uses Katch-McArdle (lean mass); otherwise Mifflin-St Jeor. The result is multiplied by an activity factor, then adjusted for the goal: fat loss −500 kcal (−250 when body fat is already low), muscle gain +300, maintenance 0, endurance +100. Calories never go below 1,500 (men) or 1,200 (women). Under BMI 18.5 the plan holds maintenance instead of a deficit.
- Protein: 2.0 g per kg of lean mass for fat loss, and 1.8, 1.4 and 1.5 g per kg of body weight for muscle gain, maintenance and endurance. Fat is at least 0.6 g per kg and about 27% of calories; carbs fill the rest.
- Four weeks like the workout plan: each goal has a weekly calorie step (fat loss has a diet break in week 4, muscle gain eases off in week 4, endurance has a recovery week). Each week shows a new menu from the original menu list, with portions scaled to the day's calories.
- Trend check: after two weigh-ins at least a week apart, the plan compares your real weekly change with your goal and suggests ±100 kcal. You choose whether to apply it.
- Water is not part of the meal plan, as you asked for water to be removed. The food diary and daily meal log are also not included.
- General guidance, not medical advice. Adults only (18–80).

## Removed in this version
The Nutrition tab (food diary and daily goals) and the Water tab are gone from Workout, and the calorie/protein rows are gone from Progress. The section is called Workout. The stored data for these fields stays in the browser but is no longer shown.

## Publishing the real full-stack app
Needs a Node host (not a static page). On Render/Railway/Fly: build `npm install`, start `npm start`, set `NODE_ENV=production`, `SESSION_SECRET` (32+ chars), `APP_URL`, `TRUST_PROXY=1`, and `DATABASE_FILE` on a persistent disk (SQLite is lost on hosts without one). Add `SMTP_*` for password-reset email. Use HTTPS.

## Still to build (from the full requirements)
Shared social feed and groups between users, subscriptions/trial billing, Gym Arena workflow, marketplace payments and fee ledger, roles, account export/deletion, backups.
