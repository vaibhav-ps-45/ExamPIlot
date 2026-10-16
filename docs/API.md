# ExamPilot — API reference

Base URL in development: `http://localhost:4000`

Every response is JSON. Errors are uniform:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "dueDate: ...", "details": [{ "path": "dueDate", "message": "..." }] } }
```

Error codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `INVALID_CREDENTIALS` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `PAYLOAD_TOO_LARGE` (413),
`RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

**Authorization rule.** Every user-owned resource is scoped to its owner on the server.
Requesting another user's resource returns **404, not 403** — the API never confirms that
a row belonging to someone else exists. Ownership ids sent by the client are always
re-verified; they are never trusted.

**Authentication.** `Authorization: Bearer <accessToken>` on everything except the auth
endpoints. The refresh token lives in an httpOnly cookie (`exampilot_refresh`, path
`/api/auth`) and is never readable by JavaScript.

---

## Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Create an account. Returns user + access token, sets the refresh cookie. |
| POST | `/login` | — | Exchange credentials for a session. |
| POST | `/refresh` | cookie | Rotate the refresh token; returns a new access token. |
| POST | `/logout` | — | Revoke the presented refresh token. |
| POST | `/logout-all` | Bearer | Revoke every session for the account. |
| GET | `/me` | Bearer | The current user. |
| POST | `/change-password` | Bearer | Change password; revokes all sessions. |

Refresh-token rotation: a token may be used once. Presenting an already-rotated token is
treated as theft — **every** session for that user is revoked.

Password policy: minimum 10 characters, at least one lowercase, one uppercase and one digit.

---

## Assessments — `/api/assessments`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List. Query: `status`, `includeArchived`, `search`. Archived excluded by default. |
| POST | `/` | Create. |
| GET | `/:id` | Read one, including `daysUntilExam`. |
| PATCH | `/:id` | Update. `archived: true/false` archives or restores. |
| DELETE | `/:id` | Delete, cascading to everything the assessment owns. |
| PUT | `/:id/schedule-preference` | `preferredStudyDays`, `dailyTargetMinutes`, `trackScheduleAdherence`. |

Create body:

```json
{
  "name": "GATE CS 2027",
  "category": "Competitive Exam",
  "description": "optional",
  "startDate": "2026-10-01T00:00:00.000Z",
  "examDate": "2027-02-07T00:00:00.000Z",
  "timeZone": "Asia/Calcutta",
  "status": "ACTIVE",
  "accentColor": "#4f46e5"
}
```

`examDate` is optional. `startDate` must not be after `examDate` (validated on create **and**
on partial update, after merging with stored values). `daysUntilExam` is a calendar-day
difference computed in the assessment's `timeZone`, and is `null` when there is no exam date.

---

## Syllabus — `/api/assessments/:assessmentId/syllabus`

| Method | Path | Description |
|---|---|---|
| GET | `/` | The full tree (subjects → topics → subtopics, any depth). |
| GET | `/templates` | Available optional templates. |
| POST | `/nodes` | Add a node. `parentId` optional. |
| PATCH | `/nodes/:nodeId` | Rename, move, or reweight a node. |
| DELETE | `/nodes/:nodeId` | Delete a subtree. **Study items are detached, never deleted.** |
| POST | `/reorder` | `{ parentId, orderedIds }`. |
| POST | `/import-template` | `{ templateId, createStudyItems, trackerId? }`. |

Moving a node validates the parent belongs to the same assessment and walks the ancestor
chain to reject cycles.

Template import is explicit and side-effect free: it creates syllabus nodes only. With
`createStudyItems: true` it also creates study items — **with no dates and no reminders**.
Each item takes its nearest parent topic as its `subject`, and `trackerId` (optional, must belong
to the same assessment) puts them in a tracker, in order. Importing twice adds a second copy; it
never merges. `gate-cs` is one optional template; nothing is hardcoded to GATE.

---

## Study items — `/api/assessments/:assessmentId/items`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List with filters. |
| POST | `/` | Create. |
| POST | `/reorder` | `{ orderedIds }`. |
| GET | `/:itemId` | Read one. |
| PATCH | `/:itemId` | Update any field. |
| POST | `/:itemId/reschedule` | **The only** way a planned date changes. |
| DELETE | `/:itemId` | Delete (attempts, sessions, bookmarks cascade). |
| GET | `/:itemId/attempts` | Practice attempts. |
| POST | `/:itemId/attempts` | Record an attempt. |
| PATCH | `/:itemId/attempts/:attemptId` | Update an attempt. |
| DELETE | `/:itemId/attempts/:attemptId` | Delete an attempt. |

List query: `page`, `pageSize`, `search`, `subject`, `topic`, `priority`, `completed`,
`bookmarked`, `dueBefore`, `dueAfter`, `trackerId`, `sort`, `direction`.

Each item returns derived fields the client renders directly:

- `dateStatus`: `NO_DATE | NOT_STARTED | DUE_TODAY | UPCOMING | OVERDUE | COMPLETED`
- `daysUntilDue`, `isOverdue`, `trackedMinutes`, `attemptCount`, `isBookmarked`, `bookmarkId`
  (notes and mock tests carry `isBookmarked` and `bookmarkId` the same way)

**`OVERDUE` is a display state only.** It never modifies `dueDate`.

`POST /:itemId/reschedule` requires at least one new date, re-validates the range, and
appends the previous values plus a reason to `metadata.rescheduleHistory` (capped at 50
entries) so planning accuracy stays auditable. Nothing calls this automatically.

Practice attempts: up to four slots by default (`Tracker.viewConfig.attemptSlots`,
configurable 1–12). Each attempt records date, questions attempted, correct answers,
marks, max marks, duration and notes. Completing an item does **not** complete its
attempts, and vice versa.

---

## Study sessions — `/api/assessments/:assessmentId/sessions`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List. Query: `studyItemId`, `from`, `to`. Returns `totalMinutes`. |
| POST | `/` | Log a session. |
| PATCH | `/:sessionId` | Update. |
| DELETE | `/:sessionId` | Delete. |

Two entry modes, and **only one per session**:

- `{ startedAt, endedAt }` — duration derived.
- `{ manualMinutes }` — explicitly entered duration.

Supplying both is a 400. `effectiveMinutes` on the response is the single figure to display.
Whenever a session changes, the owning item's `actualMinutes` is recomputed from its
sessions inside the same transaction, so the denormalised total cannot drift.

---

## Trackers — `/api/assessments/:assessmentId/trackers`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List trackers. |
| POST | `/` | Create (layout defaults to `TABLE`). |
| GET | `/:trackerId` | Read one. |
| PATCH | `/:trackerId` | Rename, recolour, density, default, `viewConfig`. |
| POST | `/:trackerId/layout` | Switch layout. |
| DELETE | `/:trackerId` | Delete. **Items are detached, never deleted.** |
| POST | `/:trackerId/columns` | Add a column. |
| PATCH | `/:trackerId/columns/:columnId` | Rename, resize, show/hide. |
| DELETE | `/:trackerId/columns/:columnId` | Remove a column. |
| POST | `/:trackerId/columns/reorder` | `{ orderedIds }`. |
| GET | `/:trackerId/views` | Saved views. |
| POST | `/:trackerId/views` | Save a view (filters, sorts, search, layout, density). |
| DELETE | `/:trackerId/views/:viewId` | Delete a saved view. |

**Layouts.** `TABLE`, `CHECKLIST`, `NOTES_BOARD` are implemented. `KANBAN` exists in the data
model so it can be added without a migration, and selecting it returns a clear 400 rather
than silently rendering something else.

**Layout switching is lossless.** All layouts render the same `StudyItem` rows; only
`Tracker.viewConfig` and `TrackerColumn` rows change. Columns the target layout cannot show
are hidden by default and restored when you switch back. Pass
`{ "layout": "CHECKLIST", "dropUnsupportedFields": true }` to delete them instead — that is
the only way configuration is ever discarded.

`viewConfig`: `{ attemptSlots (1–12), showCompleted, groupBySubject, notesBoardColumns }`.

---

## Bookmarks — `/api/bookmarks`

| Method | Path | Description |
|---|---|---|
| GET | `/` | Saved-for-later list. Query: `assessmentId`, `subject`, `targetType`, `label`. |
| POST | `/` | Bookmark a target. |
| PATCH | `/:bookmarkId` | Change label, custom label or reason. |
| DELETE | `/:bookmarkId` | Remove the bookmark. **The item itself is untouched.** |

Targets: `STUDY_ITEM`, `SYLLABUS_TOPIC`, `NOTE`, `MOCK_TEST` — exactly one per bookmark, and
the target must match `targetType`. Labels: `IMPORTANT`, `DIFFICULT`, `REVISE`,
`CONTINUE_LATER`, `CUSTOM` (a custom label is required for `CUSTOM`).

Creating a bookmark twice for the same target returns the existing one rather than erroring,
so a double-click cannot create duplicates. Each bookmark carries a `contextPath` so the UI
can open the item in its original context.

---

## Notes — `/api/assessments/:assessmentId/notes`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List. Query: `search`, `studyItemId`, `pinned`. |
| POST | `/` | Create, optionally attached to an item or syllabus node. |
| GET | `/:noteId` | Read one. |
| PATCH | `/:noteId` | Update. |
| DELETE | `/:noteId` | Delete. |

Deleting an attached study item or syllabus node leaves the note in place (its link is
nulled), so a syllabus edit cannot destroy written notes.

---

## Mock tests — `/api/assessments/:assessmentId/mock-tests`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List. Query: `from`, `to`. |
| GET | `/summary` | Count, average, best, latest, and a trend series. |
| POST | `/` | Record a test. |
| GET | `/:testId` | Read one. |
| PATCH | `/:testId` | Update. |
| DELETE | `/:testId` | Delete. |

Body: `name`, `takenOn`, `totalMarks`, `marksObtained`, `durationMinutes`, optional
`sections: [{ name, totalMarks, marksObtained, notes }]`, `notes`, `reviewed`.

`marksObtained` may not exceed `totalMarks`, and a section may not exceed its own total.
All summaries are computed from recorded results — there are no placeholder statistics.
This is manual entry and result tracking; **there is no online examination engine.**

---

## Reminders — `/api/reminders` and `/api/assessments/:assessmentId/reminders`

| Method | Path | Description |
|---|---|---|
| GET | `/api/reminders` | List. Query: `status`, `assessmentId`, `from`, `to`. |
| POST | `/api/assessments/:assessmentId/reminders` | Create a reminder. |
| PATCH | `/api/reminders/:reminderId` | Edit. Changing **when** it fires (`remindAt`, `localDateTime`, `timeZone`, `advanceMinutes`, `recurrence`) re-arms it as `PENDING`; renaming it or switching `enabled` does not. |
| POST | `/api/reminders/:reminderId/action` | `{ action: "snooze", snoozeMinutes }`, `dismiss`, or `reset`. |
| POST | `/api/reminders/disable-all` | Switches every reminder off. There is deliberately no bulk "turn on". |
| DELETE | `/api/reminders/:reminderId` | Delete. |

**Reminders are opt-in, always.** All reminders are off by default, and nothing in the system
creates one as a side effect — not a topic, a deadline, a syllabus import, a study session,
or a missed reminder. `POST /reminders` is the only creation path and is only reachable from
an explicit user action.

Provide `remindAt` (an absolute instant) or `localDateTime` plus `timeZone` (a wall-clock
intent, resolved in that zone so it survives DST). `recurrence` is
`NONE | DAILY | WEEKLY | MONTHLY`; weekly and daily keep the same local time across a DST change,
and monthly means the same date next calendar month (clamped to month end).

`advanceMinutes` is an optional early notice: the reminder notifies that many minutes **before**
`remindAt`. A snooze replaces the schedule until it ends, so it ignores the advance.

### Missed reminders

A reminder is delivered only inside a **30 minute window** after its notify time. Past that it is
**missed**: a one-off becomes `MISSED` and stays visible (`isMissed: true`); a recurring one skips
to its next upcoming occurrence, because that is the recurrence the user asked for, and does not
replay a backlog. A missed reminder is **never** delivered late, automatically rescheduled,
duplicated, or turned into a new task, and the study item it was about is not touched.

Snooze sets `snoozedUntil` and leaves `remindAt` alone. The snooze is its own delivery
occurrence, so it cannot be swallowed by the duplicate guard.

### Delivery

An in-process sweep runs every `REMINDER_SWEEP_INTERVAL_SECONDS` and delivers due reminders,
recording each under a unique `(reminder, channel, occurrenceKey)` constraint — that
constraint is what makes duplicate notifications impossible, including across restarts.

Limitations, stated plainly:

- The in-process scheduler only runs while the API process is up. For reminders that must
  fire with the application closed, run the API as a long-lived service, or call the sweep
  from an external cron.
- Browser notifications additionally need the browser open and permission granted.
- In-app notifications appear on the next fetch; there is no push channel.

---

## Analytics — `/api/analytics`

| Method | Path | Description |
|---|---|---|
| GET | `/overview` | Cross-assessment summary. |
| GET | `/api/assessments/:assessmentId/analytics` | Full assessment dashboard. |

How each metric is calculated:

- `completionPercentage` — completed items ÷ total items (items, not minutes).
- `estimatedMinutes` — sum of item estimates. `actualMinutes` — sum of session durations,
  counted once. `plannedVsActualRatio` — actual ÷ estimated.
- `dueToday` / `upcoming` / `overdue` / `noDate` — calendar days against the due date in the
  assessment's time zone; completed items are excluded from these counts.
- `adherencePercentage` — completed on time ÷ items completed with a due date. `completedLate`
  and `totalSlippageDays` describe planning accuracy; **nothing is rescheduled to improve them.**
- Mock-test averages, best and latest come from recorded results only.

An assessment with no data returns zeros and `null`s; the client renders an empty state.

---

## Settings — `/api/settings`

| Method | Path | Description |
|---|---|---|
| GET | `/` | Theme, default time zone, notification preferences. |
| PATCH | `/` | Update settings. |
| PATCH | `/profile` | Display name, time zone. |
| GET | `/sessions` | Active sessions, with the current one flagged. |
| DELETE | `/sessions/:sessionId` | Revoke one session. |

---

## Rate limiting

| Scope | Default | Env |
|---|---|---|
| `/api/auth/*` | 20 per 15 min | `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MINUTES` |
| `/api/*` | 300 per minute | `API_RATE_LIMIT_MAX`, `API_RATE_LIMIT_WINDOW_MINUTES` |

Keyed by user id when authenticated, otherwise by client IP. Rate limiters are disabled
under `NODE_ENV=test`.

## Logging

Structured JSON. Any field whose name contains `password`, `token`, `authorization`,
`cookie`, `secret` or `api_key` is redacted before writing. Stack traces are logged
server-side and never returned to a client in production.
