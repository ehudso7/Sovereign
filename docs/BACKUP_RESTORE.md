# SOVEREIGN Backup & Restore

## Database Backup

### Automated Backups (Recommended)

Configure daily automated backups with point-in-time recovery:

```bash
# Full backup via pg_dump (daily)
pg_dump -Fc -h $DB_HOST -U $DB_USER -d sovereign > sovereign_$(date +%Y%m%d_%H%M%S).dump

# WAL archiving for point-in-time recovery (continuous)
# Configure in postgresql.conf:
#   archive_mode = on
#   archive_command = 'cp %p /backups/wal/%f'
#   wal_level = replica
```

### Manual Backup

```bash
# Full database dump (custom format, compressed)
pg_dump -Fc \
  -h localhost -p 5432 \
  -U sovereign \
  -d sovereign \
  -f sovereign_backup_$(date +%Y%m%d_%H%M%S).dump

# Schema-only backup
pg_dump -Fc --schema-only \
  -h localhost -p 5432 \
  -U sovereign \
  -d sovereign \
  -f sovereign_schema_$(date +%Y%m%d_%H%M%S).dump

# Data-only backup
pg_dump -Fc --data-only \
  -h localhost -p 5432 \
  -U sovereign \
  -d sovereign \
  -f sovereign_data_$(date +%Y%m%d_%H%M%S).dump
```

### Backup Verification

Run after every backup to verify integrity:

```bash
# List contents of backup
pg_restore -l sovereign_backup_*.dump | head -50

# Test restore to a temporary database
createdb sovereign_restore_test
pg_restore -d sovereign_restore_test sovereign_backup_*.dump
psql -d sovereign_restore_test -c "SELECT count(*) FROM organizations;"
psql -d sovereign_restore_test -c "SELECT count(*) FROM agents;"
psql -d sovereign_restore_test -c "SELECT count(*) FROM runs;"
dropdb sovereign_restore_test
```

## Restore Procedure

### Full Restore

```bash
# 1. Stop all application services
pm2 stop all  # or docker compose down

# 2. Create fresh database (if needed)
dropdb sovereign
createdb sovereign

# 3. Restore from backup
pg_restore -d sovereign -c --if-exists sovereign_backup_YYYYMMDD_HHMMSS.dump

# 4. Verify restore
psql -d sovereign -c "SELECT count(*) FROM organizations;"
psql -d sovereign -c "SELECT count(*) FROM schema_migrations ORDER BY version;"

# 5. Run any pending migrations
pnpm db:migrate

# 6. Restart services
pm2 start all  # or docker compose up -d

# 7. Verify health
curl http://localhost:3002/api/v1/health
```

### Point-in-Time Recovery

If WAL archiving is configured:

```bash
# 1. Stop PostgreSQL
pg_ctl stop -D /var/lib/postgresql/data

# 2. Restore base backup
cp -r /backups/base/* /var/lib/postgresql/data/

# 3. Create recovery.conf
cat > /var/lib/postgresql/data/recovery.conf <<EOF
restore_command = 'cp /backups/wal/%f %p'
recovery_target_time = '2026-03-24 14:00:00 UTC'
EOF

# 4. Start PostgreSQL (will replay WAL to target time)
pg_ctl start -D /var/lib/postgresql/data
```

## Object Storage Backup

For agent artifacts, browser screenshots, and run outputs stored in S3/MinIO:

```bash
# Sync to backup location
aws s3 sync s3://sovereign-artifacts s3://sovereign-artifacts-backup \
  --storage-class STANDARD_IA

# Or with MinIO client
mc mirror sovereign/artifacts backup/sovereign-artifacts
```

## Backup Schedule

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full DB dump | Daily 02:00 UTC | 30 days | Encrypted S3 |
| WAL archive | Continuous | 7 days | Encrypted S3 |
| Object storage | Daily 03:00 UTC | 30 days | Backup S3 bucket |

## Backup Encryption

All backups must be encrypted at rest:

```bash
# Encrypt backup before storing
pg_dump -Fc -d sovereign | \
  gpg --symmetric --cipher-algo AES256 -o sovereign_backup_encrypted.dump.gpg

# Decrypt for restore
gpg -d sovereign_backup_encrypted.dump.gpg | pg_restore -d sovereign
```

## Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Full database loss | < 1 hour | < 24 hours (daily backup) |
| Point-in-time recovery | < 30 min | < 5 min (WAL archive) |
| Single table corruption | < 15 min | < 24 hours |
| Object storage loss | < 2 hours | < 24 hours |

## Drill Schedule

Run a restore drill at least quarterly:
1. Take current backup
2. Restore to a test environment
3. Verify data integrity (row counts, key records)
4. Verify application connectivity
5. Document results and any issues found
