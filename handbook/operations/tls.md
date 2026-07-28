# TLS & Caddy

Caddy terminates TLS in front of the stack. App containers stay on plain HTTP inside the Compose network.

## Modes

| Mode | How |
| --- | --- |
| Local CA (`tls internal`) | Default `pnpm deploy:up` |
| Public ACME | `pnpm deploy:up:acme` + `ACME_EMAIL` + public DNS |
| File certs | Mount `site.crt` / `site.key`, use `Caddyfile.file-certs` |

> [!WARNING]
> Do **not** point public DNS at a host still using `tls internal`.

After hostname changes, set `https://` origins in `.env.production` and **rebuild** so `NEXT_PUBLIC_API_BASE_URL` is baked into Next images.
