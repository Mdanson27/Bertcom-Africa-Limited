# Bertcom Africa Business Os

> Production-grade, resilient enterprise platform generated via **LiteForge / Granite Stack**.

---

## ⚡ Quickstart

### 1. Boot Container Mesh
```bash
# Start all core services in background (App, DB, Cache, Ingress)
make up
```

### 2. Database Migrations & Initial Setup
```bash
# Apply pending Alembic migrations
make migrate

# Provision initial superuser from .env settings
make seed
```

### 3. Run Automated Tests
```bash
# Execute hermetic, zero-pollution transactional test suite
make test
```

### 4. Interactive Endpoints
- **Swagger UI:** [http://localhost:8000/docs/swagger](http://localhost:8000/docs/swagger)
- **Scalar UI:** [http://localhost:8000/docs/scalar](http://localhost:8000/docs/scalar)
- **OpenAPI Schema:** [http://localhost:8000/docs/openapi.json](http://localhost:8000/docs/openapi.json)
- **Health Readiness:** [http://localhost:8000/health/ready](http://localhost:8000/health/ready)
- **Prometheus Metrics:** [http://localhost:8000/metrics](http://localhost:8000/metrics)

---

## 🛠️ Common Workflows

### Creating Database Migrations
```bash
# 1. Generate an autodetected migration revision
make migration-create MSG="add_feature_table"

# 2. Apply migration into containerized database
make migrate
```


### Syncing TypeScript Frontend SDK
```bash
# Export OpenAPI 3.1 schema & generate typed TypeScript client bindings
make frontend-sync
```


### Database Backups & Disaster Recovery
```bash
# Dump timestamped compressed PostgreSQL backup in backups/
make db-backup

# Verify backup archives
make db-backup-verify
```


### Distributed Background Worker
```bash
# Ensure background worker is active
make worker

# Tail live worker logs
make worker-logs
```



### Cloudflare Zero Trust Tunnel
```bash
# Check Cloudflare tunnel status
make tunnel-status

# Tail live tunnel logs
make tunnel-logs
```


---

## 📚 Documentation
- **[Architecture](docs/ARCHITECTURE.md)**: Container topology, clean architecture boundaries, and database design.
- **[Development](docs/DEVELOPMENT.md)**: Adding new domain features, testing runbook, and conventions.
- **[Security & RBAC](docs/SECURITY_AND_RBAC.md)**: Argon2 hashing, JWT flows, and Superadmin RBAC guards.
- **[Workers & Resilience](docs/WORKERS_AND_RESILIENCE.md)**: Asynchronous task queue, Outbox pattern, and circuit breakers.
- **[Deployment](docs/DEPLOYMENT.md)**: Production Quadlets, Traefik edge routing, and PgBouncer pooling.
- **[Operational Runbook](docs/RUNBOOK.md)**: Disaster recovery and troubleshooting recipes.
