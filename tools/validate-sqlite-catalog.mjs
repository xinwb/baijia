#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const db = new DatabaseSync(path.join(root, 'database/yadilo.sqlite'));
db.exec('PRAGMA foreign_keys = ON');

const checks = [
  ['all source products retained', 'SELECT COUNT(*) = 401 AS ok FROM products'],
  ['active products present', 'SELECT COUNT(*) > 0 AS ok FROM products WHERE active = 1'],
  ['all products have a series', 'SELECT COUNT(*) = 0 AS ok FROM products WHERE series_id IS NULL'],
  ['configurator products have door types', "SELECT COUNT(*) = 0 AS ok FROM products WHERE configurator_key IS NOT NULL AND id NOT IN (SELECT product_id FROM product_door_types)"],
  ['dimension rules are ordered', 'SELECT COUNT(*) = 0 AS ok FROM dimension_rules WHERE width_min_mm > width_default_mm OR width_default_mm > width_max_mm OR height_min_mm > height_default_mm OR height_default_mm > height_max_mm'],
  ['price values are non-negative', 'SELECT COUNT(*) = 0 AS ok FROM price_rules WHERE amount_cents < 0'],
  ['foreign keys are valid', 'PRAGMA foreign_key_check']
];

let failed = false;
for (const [label, sql] of checks) {
  const rows = db.prepare(sql).all();
  const ok = sql.startsWith('PRAGMA') ? rows.length === 0 : Boolean(rows[0]?.ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}
db.close();
if (failed) process.exitCode = 1;
