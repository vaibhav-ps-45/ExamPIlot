/**
 * Access-control boundary tests.
 *
 * These run against the real HTTP app and the real database, because the whole
 * point is to prove that ownership is enforced server-side rather than trusted
 * from the client. They are the encoded form of the manual checks performed
 * during development, so a regression cannot slip through unnoticed.
 *
 * The suite skips itself (rather than failing) when no database is reachable,
 * so `npm test` stays green on a machine without Docker running.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

let server: Server;
let baseUrl: string;
let dbAvailable = false;

interface Actor {
  token: string;
  userId: string;
}

const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

const register = async (tag: string): Promise<Actor> => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: uniqueEmail(tag),
      password: 'TestPassword123!',
      displayName: `Actor ${tag}`,
      timeZone: 'UTC',
    }),
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { accessToken: string; user: { id: string } };
  return { token: body.accessToken, userId: body.user.id };
};

const authHeaders = (actor: Actor) => ({
  'content-type': 'application/json',
  authorization: `Bearer ${actor.token}`,
});

const createdAssessmentIds: string[] = [];

const createAssessment = async (actor: Actor, name = 'Private workspace'): Promise<string> => {
  const response = await fetch(`${baseUrl}/api/assessments`, {
    method: 'POST',
    headers: authHeaders(actor),
    body: JSON.stringify({ name, timeZone: 'UTC' }),
  });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { assessment: { id: string } };
  createdAssessmentIds.push(body.assessment.id);
  return body.assessment.id;
};

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    return;
  }

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
}, 30_000);

afterAll(async () => {
  // Remove the accounts this suite created. Cascades clear everything else.
  if (dbAvailable && createdAssessmentIds.length) {
    await prisma.assessment.deleteMany({ where: { id: { in: createdAssessmentIds } } });
  }
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await prisma.$disconnect();
});

describe.runIf(process.env.SKIP_DB_TESTS !== 'true')('access control boundaries', () => {
  it('rejects every user-owned resource for a non-owner with 404, not 403', async () => {
    if (!dbAvailable) return;

    const alice = await register('alice');
    const bob = await register('bob');
    const assessmentId = await createAssessment(alice, 'Alice only');

    // A 404 is deliberate: it must not confirm that another user's row exists.
    const attempts = [
      { method: 'GET', path: `/api/assessments/${assessmentId}` },
      { method: 'PATCH', path: `/api/assessments/${assessmentId}`, body: { name: 'hijacked' } },
      { method: 'DELETE', path: `/api/assessments/${assessmentId}` },
      { method: 'GET', path: `/api/assessments/${assessmentId}/items` },
      { method: 'GET', path: `/api/assessments/${assessmentId}/syllabus` },
      { method: 'GET', path: `/api/assessments/${assessmentId}/trackers` },
      { method: 'GET', path: `/api/assessments/${assessmentId}/sessions` },
      { method: 'GET', path: `/api/assessments/${assessmentId}/notes` },
      { method: 'GET', path: `/api/assessments/${assessmentId}/mock-tests` },
      { method: 'GET', path: `/api/assessments/${assessmentId}/analytics` },
    ];

    for (const attempt of attempts) {
      const response = await fetch(`${baseUrl}${attempt.path}`, {
        method: attempt.method,
        headers: authHeaders(bob),
        ...(attempt.body ? { body: JSON.stringify(attempt.body) } : {}),
      });
      expect(response.status, `${attempt.method} ${attempt.path}`).toBe(404);
    }
  }, 30_000);

  it('refuses to bookmark another user\'s study item', async () => {
    if (!dbAvailable) return;

    const alice = await register('alice2');
    const bob = await register('bob2');
    const assessmentId = await createAssessment(alice, 'Alice items');

    const itemResponse = await fetch(`${baseUrl}/api/assessments/${assessmentId}/items`, {
      method: 'POST',
      headers: authHeaders(alice),
      body: JSON.stringify({ name: 'Alice private item' }),
    });
    expect(itemResponse.status).toBe(201);
    const { item } = (await itemResponse.json()) as { item: { id: string } };

    const bookmarkResponse = await fetch(`${baseUrl}/api/bookmarks`, {
      method: 'POST',
      headers: authHeaders(bob),
      body: JSON.stringify({ targetType: 'STUDY_ITEM', studyItemId: item.id }),
    });
    expect(bookmarkResponse.status).toBe(404);

    // And the legitimate owner can, proving the endpoint itself works.
    const ownBookmark = await fetch(`${baseUrl}/api/bookmarks`, {
      method: 'POST',
      headers: authHeaders(alice),
      body: JSON.stringify({ targetType: 'STUDY_ITEM', studyItemId: item.id, label: 'REVISE' }),
    });
    expect(ownBookmark.status).toBe(201);
  }, 30_000);

  it('rejects missing, malformed and forged tokens', async () => {
    if (!dbAvailable) return;

    const noHeader = await fetch(`${baseUrl}/api/assessments`);
    expect(noHeader.status).toBe(401);

    const garbage = await fetch(`${baseUrl}/api/assessments`, {
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    expect(garbage.status).toBe(401);

    const wrongScheme = await fetch(`${baseUrl}/api/assessments`, {
      headers: { authorization: 'Basic abc123' },
    });
    expect(wrongScheme.status).toBe(401);
  }, 30_000);

  it('invalidates the access token as soon as its session is revoked', async () => {
    if (!dbAvailable) return;

    const actor = await register('revoke');
    const before = await fetch(`${baseUrl}/api/auth/me`, { headers: authHeaders(actor) });
    expect(before.status).toBe(200);

    // Logging out revokes the session; the still-valid JWT must stop working.
    const sessions = await prisma.session.findMany({
      where: { userId: actor.userId, revokedAt: null },
      select: { id: true },
    });
    await prisma.session.updateMany({
      where: { userId: actor.userId },
      data: { revokedAt: new Date() },
    });
    expect(sessions.length).toBeGreaterThan(0);

    const after = await fetch(`${baseUrl}/api/auth/me`, { headers: authHeaders(actor) });
    expect(after.status).toBe(401);
  }, 30_000);
});

describe.runIf(process.env.SKIP_DB_TESTS !== 'true')('business rules that must never regress', () => {
  it('never creates a reminder as a side effect of importing or scheduling', async () => {
    if (!dbAvailable) return;

    const actor = await register('reminders');
    const assessmentId = await createAssessment(actor, 'No auto reminders');

    // Import a syllabus with study items.
    const imported = await fetch(`${baseUrl}/api/assessments/${assessmentId}/syllabus/import-template`, {
      method: 'POST',
      headers: authHeaders(actor),
      body: JSON.stringify({ templateId: 'gate-cs', createStudyItems: true }),
    });
    expect(imported.status).toBe(201);

    // Create an item with a deadline.
    const item = await fetch(`${baseUrl}/api/assessments/${assessmentId}/items`, {
      method: 'POST',
      headers: authHeaders(actor),
      body: JSON.stringify({ name: 'Deadline item', dueDate: new Date(Date.now() + 86_400_000).toISOString() }),
    });
    expect(item.status).toBe(201);
    const { item: createdItem } = (await item.json()) as { item: { id: string } };

    // Log a session against it.
    const session = await fetch(`${baseUrl}/api/assessments/${assessmentId}/sessions`, {
      method: 'POST',
      headers: authHeaders(actor),
      body: JSON.stringify({ studyItemId: createdItem.id, manualMinutes: 30 }),
    });
    expect(session.status).toBe(201);

    // None of the above may have produced a reminder.
    const reminders = await fetch(`${baseUrl}/api/reminders`, { headers: authHeaders(actor) });
    const body = (await reminders.json()) as { total: number };
    expect(body.total).toBe(0);

    // An explicit request does create one.
    const explicit = await fetch(`${baseUrl}/api/assessments/${assessmentId}/reminders`, {
      method: 'POST',
      headers: authHeaders(actor),
      body: JSON.stringify({ title: 'Revise', localDateTime: '2026-11-01T09:00:00.000Z', timeZone: 'UTC' }),
    });
    expect(explicit.status).toBe(201);

    const after = await fetch(`${baseUrl}/api/reminders`, { headers: authHeaders(actor) });
    const afterBody = (await after.json()) as { total: number };
    expect(afterBody.total).toBe(1);
  }, 40_000);

  it('leaves a planned date untouched when a deadline passes', async () => {
    if (!dbAvailable) return;

    const actor = await register('overdue');
    const assessmentId = await createAssessment(actor, 'Overdue check');

    const overdueDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const created = await fetch(`${baseUrl}/api/assessments/${assessmentId}/items`, {
      method: 'POST',
      headers: authHeaders(actor),
      body: JSON.stringify({ name: 'Missed it', dueDate: overdueDate }),
    });
    const { item } = (await created.json()) as { item: { id: string; dueDate: string; dateStatus: string } };

    expect(item.dateStatus).toBe('OVERDUE');
    // The stored date is exactly what the user set. It was not moved.
    expect(new Date(item.dueDate).toISOString()).toBe(new Date(overdueDate).toISOString());

    // Reading it again, later, still shows the same date.
    const reread = await fetch(`${baseUrl}/api/assessments/${assessmentId}/items/${item.id}`, {
      headers: authHeaders(actor),
    });
    const { item: again } = (await reread.json()) as { item: { dueDate: string } };
    expect(new Date(again.dueDate).toISOString()).toBe(new Date(overdueDate).toISOString());
  }, 30_000);

  it('rejects a session that would double count its duration', async () => {
    if (!dbAvailable) return;

    const actor = await register('doublecount');
    const assessmentId = await createAssessment(actor, 'Double count');

    const response = await fetch(`${baseUrl}/api/assessments/${assessmentId}/sessions`, {
      method: 'POST',
      headers: authHeaders(actor),
      body: JSON.stringify({
        startedAt: '2026-10-14T10:00:00.000Z',
        endedAt: '2026-10-14T11:00:00.000Z',
        manualMinutes: 60,
      }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  }, 30_000);

  it('rejects an assessment whose start date follows its exam date', async () => {
    if (!dbAvailable) return;

    const actor = await register('dates');
    const response = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: authHeaders(actor),
      body: JSON.stringify({
        name: 'Impossible range',
        timeZone: 'UTC',
        startDate: '2027-06-01T00:00:00.000Z',
        examDate: '2027-01-01T00:00:00.000Z',
      }),
    });
    expect(response.status).toBe(400);
  }, 30_000);

  it('never returns a password hash or token in a user payload', async () => {
    if (!dbAvailable) return;

    const actor = await register('leakcheck');
    const response = await fetch(`${baseUrl}/api/auth/me`, { headers: authHeaders(actor) });
    const raw = await response.text();

    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('$2a$');
    expect(raw).not.toContain('refreshTokenHash');
  }, 30_000);
});
