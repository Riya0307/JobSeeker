# JobSeeker

JobSeeker is a **one-sided job seeker platform** designed for individual candidates. There is no recruiter portal, company dashboard, or job-posting functionality — the entire application is built around helping job seekers manage their career search.

## Project purpose

This repository provides the foundation for a production-quality portfolio project where job seekers can (in future phases):

- Manage profiles and resumes
- Discover and match with jobs
- Track applications and interviews
- Receive AI-assisted guidance (Gemini)

**Current status:** Initial infrastructure setup only. No business features, models, or APIs beyond a health-check endpoint are implemented.

## Technology stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Axios |
| Backend | Python, Django, Django REST Framework, JWT (simplejwt) |
| Database | MySQL |
| Cache / messaging | Redis |
| Background jobs | Celery |
| Real-time (prepared) | Django Channels (ASGI + Redis channel layer) |
| AI (prepared) | Gemini API key configuration only |
| Infrastructure | Docker, Docker Compose, Nginx (reverse proxy config) |
| CI | GitHub Actions |
| Testing | pytest, pytest-django |

## Repository structure

```
JobSeeker/
├── frontend/          # React + Vite + TypeScript SPA
├── backend/           # Django REST API
│   ├── config/        # Project settings, ASGI, Celery, URLs
│   ├── apps/          # Modular Django apps (scaffolded, no models yet)
│   ├── tests/         # pytest tests
│   └── requirements/  # Python dependencies
├── docker/            # Dockerfiles and Nginx config
├── docs/              # Documentation (placeholder)
├── .github/           # GitHub Actions workflows
├── docker-compose.yml
├── .env.example
└── README.md
```

### Backend modules (prepared, not implemented)

- `accounts` — authentication and user management
- `candidates` — candidate profiles
- `resumes` — resume storage and parsing
- `jobs` — job listings for seekers
- `matching` — job matching engine
- `applications` — application tracking
- `interviews` — interview scheduling and prep
- `ai` — Gemini-powered features
- `notifications` — alerts and messaging
- `analytics` — usage and search analytics

### Frontend feature folders (prepared, not implemented)

`auth`, `dashboard`, `jobs`, `resume`, `applications`, `interviews`, `profile`

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- (Optional, for local non-Docker development)
  - Python 3.12+
  - Node.js 22+
  - MySQL 8.0+
  - Redis 7+

## Environment variables

Copy the example file and adjust values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | Django secret key (required) |
| `DJANGO_DEBUG` | Enable debug mode (`True` / `False`) |
| `DJANGO_SETTINGS_MODULE` | Settings module (default: `config.settings.development`) |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed hosts |
| `DB_NAME` | MySQL database name |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port |
| `REDIS_URL` | Redis connection URL |
| `GEMINI_API_KEY` | Gemini API key (not used yet) |
| `FRONTEND_URL` | Frontend origin for CORS |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `VITE_API_BASE_URL` | API base URL for the React frontend |

Never commit a real `.env` file containing secrets.

## Docker setup (recommended)

Start all services:

```bash
docker compose up --build
```

Services:

| Service | Port | Description |
|---------|------|-------------|
| frontend | 5173 | Vite dev server |
| backend | 8000 | Django ASGI (Daphne) |
| mysql | 3306 | MySQL 8 |
| redis | 6379 | Redis |
| celery | — | Celery worker |

Optional Nginx reverse proxy (profile `proxy`, port 8080):

```bash
docker compose --profile proxy up --build
```

## Run frontend (without Docker)

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL=http://localhost:8000/api` in your environment or `.env` file.

## Run backend (without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements/development.txt
export $(grep -v '^#' ../.env | xargs)   # Windows: set variables manually
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

## Run tests

Backend (requires MySQL and Redis, or use Docker):

```bash
cd backend
pytest
python manage.py check
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run build
```

## Run Celery

With Docker, the `celery` service starts automatically.

Manually:

```bash
cd backend
celery -A config worker -l info
```

Verify connectivity with the ping task:

```bash
celery -A config call config.ping
```

## How Redis is used

- **Celery** — message broker and result backend
- **Django Channels** — channel layer for future WebSocket/real-time features

## Future architecture

- JWT authentication endpoints (token obtain/refresh URLs are wired; registration/login not implemented)
- Modular Django apps for each domain area
- ASGI + Channels for notifications and live updates
- Celery for async tasks (resume parsing, matching, email)
- Nginx as reverse proxy on Hostinger VPS
- Local filesystem storage for uploads (no cloud storage in this phase)

## License

Private portfolio project.
