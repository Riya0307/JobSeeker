#!/bin/sh
set -e

echo "Waiting for MySQL..."
while ! python -c "import socket; s=socket.socket(); s.settimeout(1); s.connect(('${DB_HOST:-mysql}', int('${DB_PORT:-3306}'))); s.close()" 2>/dev/null; do
  sleep 1
done

echo "Running migrations..."
python manage.py migrate --noinput

exec "$@"
