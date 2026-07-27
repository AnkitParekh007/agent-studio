import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AUTH, ENV, type Auth, type Env } from '../core/tokens.js';

@Controller('api/auth')
export class AuthController {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @All('*')
  async handle(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    // Never derive the auth origin from a client-controlled Host header.
    const url = new URL(req.url, this.env.BETTER_AUTH_URL);
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
    reply.status(response.status);
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });
    const text = await response.text();
    return reply.send(text || null);
  }
}
