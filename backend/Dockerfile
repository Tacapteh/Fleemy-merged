FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Render (and many other PaaS providers) inject the PORT environment variable to
# tell the container which port to bind. When this Dockerfile hardcodes 8080 the
# app works locally, but the container stays unreachable in production because
# the platform expects the server to listen on the provided PORT (for Render the
# default is 10000). That mismatch makes the health checks fail and every
# request ends up as a 503. Run uvicorn through a tiny shell wrapper so we can
# honour $PORT while keeping a sensible default for local runs.
CMD ["/bin/sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
