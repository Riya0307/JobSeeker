# JobSeeker

JobSeeker is a one-sided platform for individual candidates. The monorepo contains a React/Vite frontend and a Django REST Framework backend, with MySQL, Redis, Celery, and Django Channels/Daphne running natively on the development machine.

The project is currently an infrastructure foundation. Business modules are scaffolded, but business features are not part of this phase. Gemini is configured through `GEMINI_API_KEY`; no AWS services are used.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Axios |
| Backend | Python 3.12, Django, Django REST Framework, SimpleJWT |
| Database | MySQL 8.x |
| Cache and messaging | Redis |
| Background jobs | Celery |
| Real-time | Django Channels, channels-redis, Daphne |
| Testing | pytest, pytest-django |
| CI | GitHub Actions with directly installed MySQL and Redis services |

## Repository structure

```text
JobSeeker/
|-- backend/            Django API, ASGI application, Celery, and tests
|-- frontend/           React/Vite application
|-- docs/               Project documentation
|-- .github/workflows/  Continuous integration
|-- .env.example        Local environment template
`-- README.md
```

## Prerequisites

- Python 3.12
- Node.js and npm
- MySQL 8.x
- Redis (a native Windows-compatible Redis server such as Memurai is suitable)
- Git

All Python packages must be installed in `backend\.venv`; do not install project dependencies globally.

## Environment setup

From the repository root:

```powershell
copy .env.example .env
```

Set a unique `DJANGO_SECRET_KEY` and configure the local MySQL credentials in `.env`. The supplied local endpoints are:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=jobseeker
DB_USER=root
DB_PASSWORD=
REDIS_URL=redis://127.0.0.1:6379/0
```

`FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and `GEMINI_API_KEY` are also configured in `.env`. Never commit real secrets.

## Backend setup

In PowerShell, from the repository root:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements/development.txt
```

If `backend\.venv` already exists, activate and reuse it instead of recreating it.

## MySQL setup

Start the installed MySQL Windows service from an elevated PowerShell prompt:

```powershell
Start-Service MySQL80
```

If the service has a different name, discover it with `Get-Service *mysql*` and use that name. Create the database from a normal terminal, entering the root password when prompted:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS jobseeker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Update `DB_USER` and `DB_PASSWORD` in `.env`, then initialize the schema:

```powershell
cd backend
.venv\Scripts\activate
python manage.py migrate
```

## Redis setup

Start the locally installed Redis-compatible Windows service from an elevated PowerShell prompt. For Memurai:

```powershell
Start-Service Memurai
```

For a Redis service registered under the conventional name:

```powershell
Start-Service Redis
```

Confirm it is available at the configured endpoint:

```powershell
redis-cli -h 127.0.0.1 -p 6379 ping
```

The expected response is `PONG`.

## Start the backend

For Django's development server:

```powershell
cd backend
.venv\Scripts\activate
python manage.py runserver
```

For the ASGI server with Django Channels support:

```powershell
cd backend
.venv\Scripts\activate
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

## Start Celery

Redis must be running first. Open another PowerShell terminal:

```powershell
cd backend
.venv\Scripts\activate
celery -A config worker -l info
```

Celery uses the same `REDIS_URL` for its broker and result backend that Channels uses for its channel layer.

## Start the frontend

Open another terminal from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

The default frontend URL is `http://localhost:5173`; the API base URL is configured with `VITE_API_BASE_URL`.

## Testing and verification

Backend:

```powershell
cd backend
.venv\Scripts\activate
python -m pip check
python manage.py check
python manage.py makemigrations --check
python manage.py migrate --plan
pytest
```

MySQL must be running for database operations and database-backed tests. Redis must be running for Celery jobs and Channels traffic, but Django's static configuration check does not open a Redis connection.

Frontend:

```powershell
cd frontend
npm run typecheck
npm run build
```

## Local service architecture

- Django/DRF serves the HTTP API on port 8000.
- Daphne serves the same Django ASGI application when Channels support is needed.
- MySQL runs locally on `127.0.0.1:3306`.
- Redis runs locally on `127.0.0.1:6379` and is shared by Celery and Channels.
- Celery runs as a separate process from `backend`.
- Vite serves the React frontend on port 5173.
