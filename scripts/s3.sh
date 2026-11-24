#!/usr/bin/env bash
# Sobe o MinIO local usado como S3 das fotos das repúblicas.
set -euo pipefail

BASE="${RAPP_S3_BASE:-$HOME/.local/share/rapp}"
DATA="$BASE/s3"
BIN="${MINIO_BIN:-$HOME/.local/bin/minio}"
ADDRESS="${S3_ADDRESS:-127.0.0.1:9000}"
CONSOLE="${S3_CONSOLE:-127.0.0.1:9001}"
export MINIO_ROOT_USER="${S3_ACCESS_KEY:-rapp}"
export MINIO_ROOT_PASSWORD="${S3_SECRET_KEY:-rapp-secret}"

mkdir -p "$DATA"

ready() {
  curl -sf -o /dev/null "http://${ADDRESS}/minio/health/live"
}

case "${1:-start}" in
  start)
    if ready; then
      echo "MinIO já está aceitando conexões em http://${ADDRESS}."
      exit 0
    fi
    if [[ ! -x "$BIN" ]]; then
      echo "MinIO não encontrado em $BIN." >&2
      exit 1
    fi
    nohup "$BIN" server "$DATA" --address "$ADDRESS" --console-address "$CONSOLE" > "$BASE/minio.log" 2>&1 &
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      if ready; then
        echo "MinIO iniciado em http://${ADDRESS} (console http://${CONSOLE})."
        exit 0
      fi
      sleep 0.3
    done
    echo "MinIO não respondeu. Veja $BASE/minio.log." >&2
    exit 1
    ;;
  stop)
    if ready; then
      pkill -f "$BIN server $DATA" || true
      echo "MinIO encerrado."
    fi
    ;;
  status)
    if ready; then
      echo "no ar em http://${ADDRESS}"
    else
      echo "parado"
      exit 1
    fi
    ;;
  *)
    echo "uso: scripts/s3.sh [start|stop|status]" >&2
    exit 1
    ;;
esac
