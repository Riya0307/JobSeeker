from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = None  # Set in environment-specific settings
DEBUG = False
ALLOWED_HOSTS: list[str] = []

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "channels",
    # Project apps
    "apps.accounts",
    "apps.candidates",
    "apps.resumes",
    "apps.jobs",
    "apps.matching",
    "apps.applications",
    "apps.interviews",
    "apps.ai",
    "apps.notifications",
    "apps.analytics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": None,
        "USER": None,
        "PASSWORD": None,
        "HOST": None,
        "PORT": None,
        "OPTIONS": {
            "charset": "utf8mb4",
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS: list[str] = []
CORS_ALLOW_CREDENTIALS = True

REDIS_URL = None
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [],
        },
    },
}

CELERY_BROKER_URL = None
CELERY_RESULT_BACKEND = None
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {}

# AI configuration (Gemini – functionality not implemented yet)
GEMINI_API_KEY = None

FRONTEND_URL = None

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
}


def _env_bool(name: str, default: bool = False) -> bool:
    import os

    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def configure_from_env(settings: dict) -> None:
    """Apply environment-driven configuration shared across environments."""
    import os

    settings["SECRET_KEY"] = os.environ["DJANGO_SECRET_KEY"]
    settings["ALLOWED_HOSTS"] = [
        host.strip()
        for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost").split(",")
        if host.strip()
    ]

    settings["DATABASES"]["default"].update(
        {
            "NAME": os.environ["DB_NAME"],
            "USER": os.environ["DB_USER"],
            "PASSWORD": os.environ["DB_PASSWORD"],
            "HOST": os.environ.get("DB_HOST", "localhost"),
            "PORT": os.environ.get("DB_PORT", "3306"),
        }
    )

    redis_url = os.environ["REDIS_URL"]
    settings["REDIS_URL"] = redis_url
    settings["CHANNEL_LAYERS"]["default"]["CONFIG"]["hosts"] = [redis_url]
    settings["CELERY_BROKER_URL"] = redis_url
    settings["CELERY_RESULT_BACKEND"] = redis_url

    settings["GEMINI_API_KEY"] = os.environ.get("GEMINI_API_KEY", "")
    settings["FRONTEND_URL"] = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS", settings["FRONTEND_URL"])
    settings["CORS_ALLOWED_ORIGINS"] = [
        origin.strip() for origin in cors_origins.split(",") if origin.strip()
    ]

    settings["DEBUG"] = _env_bool("DJANGO_DEBUG", settings.get("DEBUG", False))
