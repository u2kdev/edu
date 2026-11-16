#!/bin/bash
# ==============================================================================
# e-Darschi LMS - Automated Encrypted PostgreSQL Backup Script
# ==============================================================================
# Performs a compressed, AES-256-CBC encrypted pg_dump backup with automated
# retention rotation (retention days policy) and zero credentials leakage.
# ==============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres/edarschi}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
BACKUP_FILE="${BACKUP_DIR}/edarschi_${TIMESTAMP}.sql.gz.enc"

# 1. Validation of prerequisites
if [ -z "${DB_URL}" ]; then
  echo "[$(date)] ERROR: DIRECT_URL or DATABASE_URL must be set!" >&2
  exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "[$(date)] ERROR: BACKUP_ENCRYPTION_KEY environment variable is required to encrypt the backup!" >&2
  echo "[$(date)] Example: export BACKUP_ENCRYPTION_KEY=\$(openssl rand -hex 32)" >&2
  exit 1
fi

# Ensure backup directory exists with restricted access
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

echo "[$(date)] Starting encrypted database backup..."

# 2. Dump, compress, and encrypt using AES-256-CBC with PBKDF2 (100,000 iterations)
# Uses -pass env:BACKUP_ENCRYPTION_KEY so password never leaks into process table (ps/top).
pg_dump "${DB_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -pass env:BACKUP_ENCRYPTION_KEY -out "${BACKUP_FILE}"

# 3. Verify backup file creation and non-empty integrity
if [ -s "${BACKUP_FILE}" ]; then
  chmod 600 "${BACKUP_FILE}"
  echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
else
  echo "[$(date)] ERROR: Backup file is empty or missing!" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# 4. Retention policy: purge encrypted archives older than RETENTION_DAYS
echo "[$(date)] Cleaning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -name "edarschi_*.sql.gz.enc" -type f -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date)] Database backup routine finished successfully."

# ==============================================================================
# RESTORE INSTRUCTIONS:
# To restore from this encrypted archive, run:
# export BACKUP_ENCRYPTION_KEY="<your-secret-key>"
# openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass env:BACKUP_ENCRYPTION_KEY -in "${BACKUP_FILE}" | gunzip | psql "${DIRECT_URL}"
# ==============================================================================
