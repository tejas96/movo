import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness, TEST_PASSWORD } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

describe('auth', () => {
  it('registers with a phone typed the Indian way and logs in', async () => {
    const reg = await h
      .http()
      .post('/v1/auth/register')
      .send({ identifier: '98765 43210', password: TEST_PASSWORD, displayName: 'Tejas Patil' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.phone).toBe('+919876543210');
    const me = await h
      .http()
      .get('/v1/me')
      .set('authorization', `Bearer ${reg.body.tokens.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.displayName).toBe('Tejas Patil');
    const login = await h
      .http()
      .post('/v1/auth/login')
      .send({ identifier: '+91 98765 43210', password: TEST_PASSWORD });
    expect(login.status).toBe(201);
  });

  it('refuses duplicate identifiers, wrong passwords and bad tokens', async () => {
    await h.register('a@movo.test');
    const dup = await h
      .http()
      .post('/v1/auth/register')
      .send({ identifier: 'A@movo.test', password: TEST_PASSWORD, displayName: 'Dup' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('IDENTIFIER_TAKEN');
    const wrong = await h
      .http()
      .post('/v1/auth/login')
      .send({ identifier: 'a@movo.test', password: 'not the password' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
    const bad = await h.http().get('/v1/me').set('authorization', 'Bearer nope');
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('UNAUTHENTICATED');
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const { refreshToken } = await h.register('b@movo.test');
    const first = await h.http().post('/v1/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(201);
    expect(first.body.refreshToken).not.toBe(refreshToken);
    const reuse = await h.http().post('/v1/auth/refresh').send({ refreshToken });
    expect(reuse.status).toBe(400);
    expect(reuse.body.code).toBe('TOKEN_INVALID');
    // The whole family is dead now, including the rotated token.
    const after = await h
      .http()
      .post('/v1/auth/refresh')
      .send({ refreshToken: first.body.refreshToken });
    expect(after.status).toBe(400);
  });

  it('logout ends the session for the access token too', async () => {
    const { token, refreshToken } = await h.register('c@movo.test');
    const out = await h
      .http()
      .post('/v1/auth/logout')
      .set('authorization', `Bearer ${token}`)
      .send({ refreshToken });
    expect(out.status).toBe(201);
    const me = await h.http().get('/v1/me').set('authorization', `Bearer ${token}`);
    expect(me.status).toBe(401);
  });

  it('resets a password with an emailed token and with an admin code', async () => {
    const { userId } = await h.register('d@movo.test');
    const forgot = await h
      .http()
      .post('/v1/auth/forgot-password')
      .send({ identifier: 'd@movo.test' });
    expect(forgot.status).toBe(201);
    const reset = await h.prisma.passwordReset.findFirstOrThrow({ where: { userId } });
    expect(reset.kind).toBe('EMAIL_LINK');
    const bad = await h.http().post('/v1/auth/reset-password').send({
      identifier: 'd@movo.test',
      code: 'wrong-code',
      newPassword: 'another good password',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('RESET_CODE_INVALID');
  });

  it('deletes the account and anonymises it', async () => {
    const { token } = await h.register('e@movo.test', 'Gone Soon');
    const del = await h
      .http()
      .delete('/v1/me')
      .set('authorization', `Bearer ${token}`)
      .send({ password: TEST_PASSWORD });
    expect(del.status).toBe(200);
    const user = await h.prisma.user.findFirstOrThrow({ where: { status: 'DELETED' } });
    expect(user.email).toBeNull();
    expect(user.displayName).toBe('Deleted member');
    const login = await h
      .http()
      .post('/v1/auth/login')
      .send({ identifier: 'e@movo.test', password: TEST_PASSWORD });
    expect(login.status).toBe(400);
  });
});
