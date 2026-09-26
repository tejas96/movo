import { Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { loadEnv } from '../../config/env';

export interface AccessClaims {
  sub: string;
  sid: string;
}

@Injectable()
export class JwtService {
  private readonly key = new TextEncoder().encode(loadEnv().JWT_SECRET);
  private readonly ttlSeconds = loadEnv().ACCESS_TOKEN_TTL_MINUTES * 60;

  async sign(claims: AccessClaims): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const token = await new SignJWT({ sid: claims.sid })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.sub)
      .setIssuedAt()
      .setIssuer('movo')
      .setAudience('movo-app')
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { token, expiresAt };
  }

  async verify(token: string): Promise<AccessClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: 'movo',
        audience: 'movo-app',
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
      return { sub: payload.sub, sid: payload.sid };
    } catch {
      return null;
    }
  }
}
