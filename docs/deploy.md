# Deploy (issue #17)

Provider-agnostic: any Ubuntu 24.04 VM with 2+ GB RAM and Docker works.
Free path for students: GitHub Student Developer Pack -> DigitalOcean credit
(+ free .me/.TECH domain). Fallback: Oracle Cloud Always Free + DuckDNS.

## One-time server setup

```bash
# 1. On the VM (as root or sudo user)
curl -fsSL https://get.docker.com | sh

# 2. Clone the repo (compose file + initdb SQL live here)
git clone https://github.com/MariusReik/MarinProsjekt.git /opt/marin
cd /opt/marin/infra
cp .env.prod.example .env
nano .env          # DOMAIN, POSTGRES_PASSWORD (generate!), BW credentials

# 3. Open firewall for 80/443 (provider dashboard or ufw)
```

## DNS

Point an A-record for `DOMAIN` at the server's IP. Caddy handles TLS
certificates automatically once DNS resolves.

## GHCR images

CI pushes images to GHCR on every push to main. Make the three packages
public (github.com -> Packages -> package -> settings -> visibility) so the
server can pull without credentials.

## First deploy

```bash
cd /opt/marin/infra
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps    # all services healthy?
```

Verify: `https://DOMAIN` shows the map, `https://DOMAIN/api/positions/latest`
returns JSON, vessels move.

## Continuous deploy

GitHub Actions (`.github/workflows/deploy.yml`) builds and pushes images,
then SSHes in and runs `compose pull && up -d`. Add repo secrets:

- `DEPLOY_HOST` – server IP or hostname
- `DEPLOY_USER` – SSH user (e.g. root or deploy)
- `DEPLOY_SSH_KEY` – private key (generate a dedicated pair: `ssh-keygen -t ed25519`,
  put the public half in `~/.ssh/authorized_keys` on the server)

## Notes

- The dev compose file (`docker-compose.yml`) is unchanged and local-only.
- Database bootstrap: `initdb/` runs on first start (empty volume); Flyway
  handles API-owned migrations on top.
- Rollback: `docker compose -f docker-compose.prod.yml pull` a previous
  `:sha` tag by editing the image tags, or redeploy an older commit.
