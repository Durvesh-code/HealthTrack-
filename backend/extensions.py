# backend/extensions.py
#
# Shared Flask extension instances.
#
# Why this file exists: app.py previously created the Limiter *inside*
# create_app() as a local variable, which meant only app.py could see it.
# The chatbot endpoint needs its own, stricter rate limit (LLM calls cost
# money), so the same Limiter instance now lives here at module level.
# app.py calls limiter.init_app(app); any controller can
# `from extensions import limiter` and use @limiter.limit(...) directly.

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["5000 per day", "1000 per hour", "200 per minute"],
    storage_uri="memory://",
)
