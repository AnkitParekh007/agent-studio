# Caddy TLS front door

`docker-compose.prod.yml` runs Caddy on `443` and terminates TLS in front of the API and the
three Next.js services. Everything behind Caddy stays on plain HTTP inside the Compose network.

## Certificates

`tls internal` is the default: Caddy runs its own local CA and issues certificates into the
`agentstudio_prod_caddy` volume on first boot. **No certificate or private key is committed to
this repository**, and none is written into `deploy/caddy/`.

Trust the generated CA on a client machine:

```bash
docker compose -f docker-compose.prod.yml cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
# then import caddy-root.crt into the OS/browser trust store
```

## Real certificates

Pick one and edit the `(site)` snippet in `Caddyfile`:

| Mode | Directive | Notes |
| --- | --- | --- |
| Operator-supplied | `tls /etc/caddy/certs/site.crt /etc/caddy/certs/site.key` | Mount the pair into `deploy/caddy/certs/` (git-ignored) |
| Public ACME | `tls you@example.com` | Needs public DNS pointing at the host and inbound `80` + `443` |

## Hostnames

Set these in `.env.production` and point DNS (or `/etc/hosts`) at the Caddy host:

| Variable | Default | Upstream |
| --- | --- | --- |
| `CADDY_API_HOST` | `api.localhost` | `api:4000` |
| `CADDY_CONTROL_PLANE_HOST` | `studio.localhost` | `control-plane-web:3000` |
| `CADDY_AGENT_RUNTIME_HOST` | `apps.localhost` | `agent-web-runtime:3001` |
| `CADDY_EMBED_HOST` | `embed.localhost` | `embed-runtime:3002` |

Keep `API_BASE_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_API_BASE_URL`, the three `*_ORIGIN`
variables and `CORS_ORIGINS` pointed at the same `https://` hostnames, and rebuild so
`NEXT_PUBLIC_API_BASE_URL` is baked into the Next images.
