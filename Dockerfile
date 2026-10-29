# Image de la démo en ligne (sans Oracle) : interface + serveur de démonstration api/dev_mock.py.
# Le projet complet (Oracle XE + API) se lance avec docker-compose et les scripts/ : voir le README.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY api/requirements-demo.txt api/requirements-demo.txt
RUN pip install --no-cache-dir -r api/requirements-demo.txt

COPY api/dev_mock.py api/dev_mock.py
COPY api/static api/static

RUN useradd --system --no-create-home bankcore
USER bankcore
EXPOSE 8080
WORKDIR /app/api

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os,sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT', '8080'), timeout=4).status == 200 else 1)"

# Un seul worker : les données de démo vivent en mémoire du processus.
# Render / Railway / Fly.io fournissent PORT ; 8080 par défaut en local.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 4 --access-logfile - dev_mock:app"]
