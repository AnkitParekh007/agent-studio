import { All, Controller, HttpException, HttpStatus, Inject, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AUTH, ENV, REDIS, type Auth, type Env, type Redis } from '../core/tokens.js';
import { logWarn } from '../core/logger.js';
import { MetricsService } from '../core/metrics.service.js';

/** Endpoints where a 4xx counts as a failed credential attempt. */
const SIGN_IN_PATHS = ['/sign-in/', '/two-factor/'];

function isSignInPath(pathname: string) {
  return SIGN_IN_PATHS.some((p) => pathname.includes(p));
}

function attemptedEmail(body: unknown): string {
  if (body && typeof body === 'object' && 'email' in body) {
    const email = (body as { email?: unknown }).email;
    if (typeof email === 'string') return email.trim().toLowerCase().slice(0, 200);
  }
  return '';
}

@Controller('api/auth')
export class AuthController {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  @All('*')
  async handle(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    // Never derive the auth origin from a client-controlled Host header.
    const url = new URL(req.url, this.env.BETTER_AUTH_URL);
    const ip = req.ip || 'unknown';
    const email = isSignInPath(url.pathname) ? attemptedEmail(req.body) : '';

    await this.enforceRateLimit(ip);
    if (email) await this.assertNotLockedOut(ip, email);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(','));
    }
    headers.set('host', url.host);

    let body: string | undefined;
    if (!['GET', 'HEAD'].includes(req.method)) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    }

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    const response = await this.auth.handler(request);
    if (email) await this.recordAttempt(ip, email, response.status);

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });
    const text = await response.text();
    return reply.send(text || null);
  }

  /** Fixed-window per-IP limit shared across API replicas via Redis. */
  private async enforceRateLimit(ip: string) {
    const windowMs = 60_000;
    const limit = this.env.AUTH_RATE_LIMIT_PER_MINUTE;
    const key = `auth:ratelimit:${ip}:${Math.floor(Date.now() / windowMs)}`;

    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.pexpire(key, windowMs * 2);
    if (count > limit) {
      this.metrics.increment('auth_rate_limited');
      throw new HttpException(
        `Too many authentication requests (${limit}/minute)`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private lockKey(ip: string, email: string) {
    return `auth:lockout:${ip}:${email}`;
  }

  private failureKey(ip: string, email: string) {
    return `auth:failures:${ip}:${email}`;
  }

  private async assertNotLockedOut(ip: string, email: string) {
    const locked = await this.redis.get(this.lockKey(ip, email));
    if (!locked) return;
    this.metrics.increment('auth_lockout_blocked');
    throw new HttpException(
      'Account temporarily locked after repeated failed sign-in attempts',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async recordAttempt(ip: string, email: string, status: number) {
    if (status < 400) {
      await this.redis.del(this.failureKey(ip, email));
      return;
    }
    // 429s are already throttled upstream; only credential rejections count.
    if (status === HttpStatus.TOO_MANY_REQUESTS) return;

    const failures = await this.redis.incr(this.failureKey(ip, email));
    if (failures === 1) {
      await this.redis.pexpire(this.failureKey(ip, email), this.env.AUTH_LOCKOUT_WINDOW_MS);
    }
    if (failures >= this.env.AUTH_LOCKOUT_MAX_FAILURES) {
      await this.redis.set(
        this.lockKey(ip, email),
        '1',
        'PX',
        this.env.AUTH_LOCKOUT_DURATION_MS,
      );
      await this.redis.del(this.failureKey(ip, email));
      this.metrics.increment('auth_lockouts_applied');
      logWarn('auth_lockout_applied', { ip, failures });
    }
  }
}
