# backend/gunicorn.conf.py
import os

# Bind to localhost on port 5000 (adjust as needed for deployment)
bind = "0.0.0.0:5000"

# Use threads instead of gevent to avoid memory issues and monkey-patching bugs in Python 3.11
worker_class = "gthread"

# 1 worker with 4 threads easily fits in Render's 512MB Free Tier while still handling concurrent LLM requests
workers = 1
threads = 4

# Increase timeout for long-running LLM generation
timeout = 120

# Log level
loglevel = "info"
