# Production Launch Checklist

## Pre-Launch Security Audit

### ✅ Secrets Management
- [x] All sensitive data in environment variables (never hardcoded)
- [x] `.env` files excluded from version control
- [x] Environment variable validation schemas in place
- [x] Separate credentials for each environment (dev/staging/prod)
- [x] API keys rotated and production-ready

### ✅ Infrastructure Security
- [x] TLS/SSL enabled on all endpoints (Temporal Cloud, Database, Redis)
- [x] Database connection using SSL (`sslmode=require`)
- [x] Redis using TLS (`rediss://` protocol)
- [x] Temporal Cloud using API key authentication
- [x] S3/R2 bucket with proper access controls

### ✅ Application Security
- [x] WorkOS SSO/SCIM for enterprise authentication
- [x] Session secrets properly generated (48+ bytes)
- [x] SOVEREIGN_SECRET_KEY backed up securely
- [x] Input validation on all API endpoints
- [x] Tenant isolation enforced in database queries

## Deployment Configuration

### ✅ GitHub Actions Secrets
Add these to your repository settings:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_WEB_PROJECT_ID`
- `VERCEL_DOCS_PROJECT_ID`
- `RAILWAY_TOKEN`
- `DATABASE_URL`

### ✅ Vercel Environment Variables
Configure in Vercel dashboard:
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_WORKOS_CLIENT_ID`

### ✅ Railway Environment Variables
Configure in Railway dashboard:
- All variables from `.env` file
- Ensure services are properly linked

## Pre-Launch Testing

### Database
- [ ] Run migrations: `pnpm db:migrate`
- [ ] Verify connection pooling is working
- [ ] Test failover/recovery

### Authentication
- [ ] Test WorkOS SSO flow
- [ ] Verify session persistence
- [ ] Test logout/session expiry

### Temporal Workflows
- [ ] Test worker connectivity to Temporal Cloud
- [ ] Verify workflow execution
- [ ] Check retry/failure handling

### API Endpoints
- [ ] Health checks responding
- [ ] Rate limiting configured
- [ ] Error handling working

### Storage
- [ ] Verify S3/R2 upload/download
- [ ] Test large file handling
- [ ] Check access permissions

## Monitoring & Observability

### Logging
- [ ] Application logs aggregated
- [ ] Error tracking configured
- [ ] Audit logs enabled

### Metrics
- [ ] Performance monitoring setup
- [ ] Resource usage tracking
- [ ] API endpoint monitoring

### Alerts
- [ ] Critical error alerts
- [ ] Service downtime alerts
- [ ] Security incident alerts

## Launch Steps

1. **Final Code Review**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

2. **Deploy to Staging**
   ```bash
   git push origin main
   # GitHub Actions will deploy to staging
   ```

3. **Production Smoke Test**
   - [ ] Create test organization
   - [ ] Run through critical user flows
   - [ ] Verify all integrations

4. **Go Live**
   - [ ] Deploy to production via GitHub Actions
   - [ ] Monitor logs for first 30 minutes
   - [ ] Verify all health checks

5. **Post-Launch**
   - [ ] Announce launch
   - [ ] Monitor user feedback
   - [ ] Be ready for hotfixes

## Emergency Procedures

### Rollback Plan
```bash
# Via Vercel Dashboard
# Instant rollback to previous deployment

# Via Railway Dashboard
# Rollback to previous service version
```

### Critical Contacts
- Infrastructure: Railway/Vercel support
- Database: Neon support
- Authentication: WorkOS support
- Payments: Stripe support

## Security Reminders

⚠️ **NEVER**:
- Commit `.env` files
- Log sensitive data
- Store secrets in code
- Share production credentials

✅ **ALWAYS**:
- Rotate credentials regularly
- Use least-privilege access
- Monitor for suspicious activity
- Keep dependencies updated