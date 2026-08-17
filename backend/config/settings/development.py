from .base import *  # noqa: F403
from .base import configure_from_env

DEBUG = True

configure_from_env(globals())
