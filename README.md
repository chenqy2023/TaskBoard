# TaskBoard

**Self-hosted project & task progress board for small teams.**

[中文文档](README_ZH.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)

[Screenshots](#screenshots) · [Quick start](#quick-start) · [Deploy](#deploy) · [Features](#key-features) · [API](http://localhost:3000/api/docs) · [Contributing](CONTRIBUTING.md)

Drag cards across columns, roll up progress automatically, collaborate with comments and an activity log, and keep everyone in sync over Socket.IO — full TypeScript stack, one `docker compose` command to ship.

---

## Screenshots

| Projects | Board |
| --- | --- |
| <img src="docs/screenshots/02-projects.png" alt="Projects" width="420" /> | <img src="docs/screenshots/03-board.png" alt="Kanban board" width="420" /> |

---

## Key features

- **Kanban that tracks progress** — Four columns (To do / In progress / Blocked / Done), drag to change status, reorder within a column; move to Done sets progress to 100%.
- **Projects with a clear overview** — Master–detail home: pick a project, preview summary and a mini board, then open board / list / stats.
- **Tasks built for real work** — Assignee, multiple participants, priority, 0–100 progress, planned & actual date pair; table view with filters, sort, batch update, and “My tasks”.
- **Collaboration without noise** — Comments plus an activity timeline (who changed what from → to).
- **Live multi-user sync** — Socket.IO pushes board changes; others see updates without a manual refresh.
- **Stats at a glance** — ECharts by status, priority, and assignee (counts & average progress).
- **English & 简体中文** — Switcher on login and in the header; preference is persisted locally.
- **Auth that fits small teams** — Username/password with `ADMIN` / `MEMBER` roles.

---

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Vue 3 · Vite · TypeScript · Ant Design Vue · Pinia · ECharts · Socket.IO Client |
| Backend | NestJS · Prisma · TypeScript · Passport JWT · Socket.IO |
| Database | PostgreSQL 16 |
| Deploy | Docker Compose (`nginx` + `api` + `postgres`) |

---

## Quick start

Requires **Node.js 20+** and **Docker**.

```bash
# 1. Env
cp .env.example .env

# 2. Database only (host port 5432 by default; change POSTGRES_PORT if busy)
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d

# 3. Backend
cd backend
npm install
npx prisma migrate deploy     # schema
npx prisma db seed            # bootstrap admin
npm run start:dev             # http://localhost:3000/api · Swagger /api/docs

# 4. Frontend (another terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

| | |
| --- | --- |
| Admin user | `admin` |
| Password | `ADMIN_INITIAL_PASSWORD` in `.env` (default `Admin@123456`) — **change after first login** |

Vite proxies `/api` and `/socket.io` to `localhost:3000` in development (no CORS setup).

### Demo data

For local screenshots and walkthroughs:

```bash
cd backend && npm run db:seed:demo
```

Creates five themed fictional projects (Product Launch / Website Redesign / Mobile Sprint / Infra Reliability / Customer Onboarding; members `alice` / `bob` / `carol`, tasks in all columns, comments & activities). Copy is stored in English; the UI remaps titles when you switch language. Demo password defaults to `Demo@123456` (`DEMO_USER_PASSWORD`). **Do not** run on production.

---

## Deploy

Production in one compose stack:

```bash
cp .env.example .env
# At minimum set:
#   JWT_SECRET=$(openssl rand -hex 32)
#   POSTGRES_PASSWORD=<strong password>
#   ADMIN_INITIAL_PASSWORD=<initial admin password>
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
# → http://<server-ip>:8080
```

The `api` container runs migrations and admin bootstrap on start (idempotent).

API reference while the backend is running: Swagger at `http://localhost:3000/api/docs` (or your deployed host + `/api/docs`).

---

## Tests

```bash
cd backend && npm run test
cd frontend && npm run typecheck

python scripts/api-smoke.py
python scripts/api-smoke.py --base http://localhost:8080/api

cd frontend && node scripts/ws-smoke.mjs http://localhost:8080
```

---

## Layout

```
├─ backend/            NestJS + Prisma
│  ├─ prisma/          schema, migrations, seed
│  └─ src/             auth · users · projects · tasks · comments · activities · stats · realtime
├─ frontend/           Vue 3 + Vite + Ant Design Vue
├─ docker/             prod & dev Compose files
└─ scripts/            api-smoke.py · ws helpers
```

---

## Notes

1. **Compose does not auto-load the repo-root `.env`.** Compose v2 uses the compose file’s directory (`docker/`) as the project dir — always pass `--env-file .env` from the repo root.
2. **Socket.IO behind nginx needs `Upgrade` headers**, or it falls back to polling and sync looks broken. `frontend/nginx.conf` already sets this.

---

## Security

- Do not commit real secrets; use `.env` (gitignored) and keep placeholders in `.env.example`.
- Report security issues privately to the maintainers when possible; avoid posting exploitable details in public issues.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and focused PRs are welcome.

---

## License

[MIT](LICENSE) — free to use, modify, and self-host.
