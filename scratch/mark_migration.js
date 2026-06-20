import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const migrationName = '20260620130900_add_slug_to_first_aid_guides';
  
  // Read migration.sql content to compute checksum
  const fs = require('fs');
  const sql = fs.readFileSync('prisma/migrations/20260620130900_add_slug_to_first_aid_guides/migration.sql', 'utf8');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');

  console.log('Inserting migration into database...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO _prisma_migrations (
      id,
      checksum,
      finished_at,
      migration_name,
      logs,
      rolled_back_at,
      started_at,
      applied_steps_count
    ) VALUES (
      ?,
      ?,
      NOW(),
      ?,
      NULL,
      NULL,
      NOW(),
      1
    )
  `, 
    crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    checksum,
    migrationName
  );

  console.log('Migration successfully marked as applied!');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
