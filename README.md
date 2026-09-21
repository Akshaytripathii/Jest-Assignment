# Salon Booking API - SDET Assignment

## What this is

An automated test suite for a salon booking backend. I wrote tests at two levels: focused endpoint tests that hit one behaviour at a time, and a full end-to-end flow that walks through the whole journey a real customer would take — register, log in, book a slot, then cancel it.

## Stack

- **Backend:** Node.js, Express, CommonJS, Mongoose
- **Tests:** Jest, Supertest, mongodb-memory-server (no real database needed)

## Getting started

Install dependencies:
```bash
npm install
```

Run the tests:
```bash
npm test
```

That's it. The in-memory MongoDB spins up automatically — no local Mongo, no Docker, no `.env` to configure.

## What's tested

### Auth tests (`__tests__/auth.test.js`) — 12 tests

| Area | What's covered |
|---|---|
| Registration | ✅ New user registers successfully |
| | ❌ Duplicate email is rejected |
| | ❌ Missing password, name, or email is rejected |
| Login | ✅ Correct credentials return a token |
| | ❌ Unrecognised email is rejected |
| | ❌ Wrong password is rejected |
| Auth middleware | ✅ Valid token gets through |
| | ❌ Missing token is rejected |
| | ❌ Tampered/invalid token is rejected |

### E2E tests (`__tests__/e2e.test.js`) — 14 tests

| Area | What's covered |
|---|---|
| Happy path | ✅ Full register → login → book → cancel journey |
| Registration | ❌ Duplicate email, missing password |
| Login | ❌ Unknown email, wrong password |
| Booking | ❌ Missing date, non-existent service, conflicting slot, no token |
| Cancellation | ❌ Cancel someone else's booking, cancel an already-cancelled booking, cancel a booking that doesn't exist, no token |
| | ✅ Admin can cancel any user's booking |

## Why I used a real in-memory database instead of mocks

I tried mocking `User` first. The "missing password" test passed — but for the wrong reason. With the model fully mocked, Mongoose validation never ran, so the test was really just checking whether `bcrypt.hash()` throws on `undefined`. That's not useful. Switching to `mongodb-memory-server` means the tests hit actual schema validation, actual error handling, and actual database logic. They test what the API does, not what I assumed it would do.

## Bugs I found

1. **Hidden malicious code in `index.ts`.** There was an `eval(atob(...))` block buried after `mongoose.connect()`, hidden behind a wall of blank lines so it wasn't visible without scrolling. Removed it.
2. **App and server were coupled together.** `index.ts` was doing everything — building the Express app, connecting to Mongo, and calling `app.listen()` — in one file. That makes Supertest impossible to use without spinning up a real port and a real database. Split it: `app.js` just sets up the Express app, `index.js` handles the startup.

## Things I noticed but left alone

These are real issues, but fixing them would mean changing app behaviour, which wasn't the ask:

- **Email matching is case-sensitive.** `test@example.com` and `Test@Example.com` are treated as different accounts and can both register.
- **Missing required fields return 500, not 400.** There's no input validation layer, so a missing `password` falls through to `bcrypt.hash()`, throws, and gets caught as a generic server error. It works, but a proper 400 with a clear message would be friendlier.
- **No whitespace trimming on text fields.** A name or email with leading/trailing spaces gets saved as-is.

## Demo Videos

- [Loom Video 1](https://www.loom.com/share/7877cdef5fa1422ab149480593aa6387)
- [Loom Video 2](https://www.loom.com/share/7877cdef5fa1422ab149480593aa6387)