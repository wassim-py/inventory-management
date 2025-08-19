# Database Migration Guide: Legacy to SRS Schema

## Migration Steps

### 1. Backup Current Database
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Replace Schema
```bash
# Backup current schema
cp prisma/schema.prisma prisma/schema-legacy.prisma

# Replace with SRS schema
cp prisma/schema-srs.prisma prisma/schema.prisma

# Generate new Prisma client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name "migrate-to-srs-schema"
```

### 3. Data Migration Script
Run the data migration script (to be created) to preserve any existing data:

```bash
npm run migrate:data
```

### 4. Seed New Database
```bash
npm run seed
```

## Important Notes

- This is a breaking change that requires complete API and frontend updates
- All existing API endpoints will need to be updated
- Frontend components will need to be rebuilt for new data structures
- Consider running this migration in a staging environment first

## Rollback Plan

If issues occur:
1. Restore from backup: `psql $DATABASE_URL < backup_file.sql`
2. Revert schema: `cp prisma/schema-legacy.prisma prisma/schema.prisma`
3. Generate client: `npx prisma generate`