from config.celery import app


@app.task(name="config.ping")
def ping():
    """Health-check task to verify Celery connectivity."""
    return "pong"
