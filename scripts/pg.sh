#!/usr/bin/env bash
# Sobe o PostgreSQL local do rAPP (PostGIS já carregado no cluster do usuário).
set -euo pipefail

BASE="${RAPP_PG_BASE:-$HOME/.local/share/rapp}"
PGDATA="$BASE/pgdata"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/14/bin}"
PORT="${PGPORT:-5433}"

export LD_LIBRARY_PATH="$BASE/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PROJ_LIB="$BASE/root/usr/share/proj"
export PROJ_DATA="$PROJ_LIB"
export GDAL_DATA="$BASE/root/usr/share/gdal"
export PGPASSWORD="${PGPASSWORD:-rapp}"

if [[ ! -x "$PG_BIN/pg_ctl" ]]; then
  echo "PostgreSQL não encontrado em $PG_BIN." >&2
  exit 1
fi

if [[ ! -d "$PGDATA/base" ]]; then
  echo "Cluster não inicializado em $PGDATA." >&2
  echo "O banco desta máquina foi preparado com PostgreSQL 14 + PostGIS 3.2 em $BASE." >&2
  exit 1
fi

mkdir -p "$BASE/run"

ready() {
  "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PORT" -q
}

case "${1:-start}" in
  start)
    if ready; then
      echo "PostgreSQL já está aceitando conexões em 127.0.0.1:$PORT."
      exit 0
    fi
    "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$BASE/postgres.log" -w start
    echo "PostgreSQL iniciado em 127.0.0.1:$PORT."
    ;;
  stop)
    if ready; then
      "$PG_BIN/pg_ctl" -D "$PGDATA" -w stop
    fi
    ;;
  status)
    if ready; then
      echo "no ar em 127.0.0.1:$PORT"
    else
      echo "parado"
      exit 1
    fi
    ;;
  *)
    echo "uso: scripts/pg.sh [start|stop|status]" >&2
    exit 1
    ;;
esac
