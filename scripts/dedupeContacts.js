#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env if present (simple parser)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2] || '';
      // strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set in environment or .env');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query('SELECT id, "fullName" as fullname, "company", "mobileNumbers", "telephoneNumbers", "emails", "rawNotes" FROM "Contact" ORDER BY "createdAt" ASC');

  const seen = new Map();
  const duplicates = [];

  for (const row of res.rows) {
    const email = Array.isArray(row.emails) && row.emails.length ? String(row.emails[0]) : null;
    const mobile = Array.isArray(row.mobilenumbers) && row.mobilenumbers.length ? String(row.mobilenumbers[0]) : null;
    const tel = Array.isArray(row.telephonenumbers) && row.telephonenumbers.length ? String(row.telephonenumbers[0]) : null;

    const key = email ? `email:${email}` : mobile ? `mobile:${mobile}` : tel ? `tel:${tel}` : `namecomp:${(row.fullname||'')}|${(row.company||'')}`;

    if (seen.has(key)) {
      duplicates.push({ id: row.id, keepId: seen.get(key), reason: key });
    } else {
      seen.set(key, row.id);
    }
  }

  console.log(`Found ${duplicates.length} potential duplicates.`);
  for (const d of duplicates) {
    console.log(`Duplicate: ${d.id} (keep ${d.keepId}) reason=${d.reason}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
