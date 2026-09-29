#!/usr/bin/env node
/**
 * SQLite ? → PostgreSQL $1,$2... placeholder converter
 * Runs on all server route/service/auth .ts files
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const FILES = [
  'server/routes/settingRoutes.ts',
  'server/routes/listingRoutes.ts',
  'server/routes/moderationRoutes.ts',
  'server/routes/locationRoutes.ts',
  'server/routes/userRoutes.ts',
  'server/routes/reviewRoutes.ts',
  'server/routes/savedRoutes.ts',
  'server/routes/notificationRoutes.ts',
  'server/routes/adminRoutes.ts',
  'server/routes/organizationRoutes.ts',
  'server/routes/authRoutes.ts',
  'server/routes/chatRoutes.ts',
  'server/routes/categoryRoutes.ts',
  'server/services/autoModerationService.ts',
  'server/services/chatService.ts',
  'server/services/moderationService.ts',
  'server/services/expirationService.ts',
  'server/services/listingService.ts',
  'server/auth/telegram.ts',
];

/**
 * Convert a SQL string with ? placeholders to PostgreSQL $1, $2, ... format.
 * Only converts literal ? inside template literals/strings passed to
 * queryAll / queryOne / runQuery / runTransaction.
 */
function convertPlaceholders(sql) {
  let idx = 1;
  return sql.replace(/\?/g, () => `$${idx++}`);
}

/**
 * Process a single file: find all SQL string arguments to query helpers
 * and replace ? with $N.
 */
function processFile(filePath) {
  const abs = path.join(ROOT, filePath);
  if (!fs.existsSync(abs)) {
    console.warn(`  SKIP (not found): ${filePath}`);
    return;
  }

  let content = fs.readFileSync(abs, 'utf8');
  const original = content;

  // Strategy: find template literals or string literals that look like SQL
  // and contain ? – replace each ? sequentially within each SQL string.
  
  // Match SQL strings passed to queryAll/queryOne/runQuery/runTransaction
  // Pattern: (queryAll|queryOne|runQuery)( followed by a string
  // We use a state-machine approach on the raw text.

  // Simple approach: replace ? inside backtick template literals line by line
  // within query helper calls. We'll do a global regex that handles:
  // 1. Multi-line template literals with ?
  // 2. Single/double quoted strings with ?

  // Replace all ? in SQL template literals / strings (any quotes)
  // We process the entire file content, resetting counter per queryXxx call.

  // Split on queryAll/queryOne/runQuery/runTransaction and process each chunk
  const parts = content.split(/(queryAll|queryOne|runQuery|runTransaction)\s*[(<]/);
  if (parts.length > 1) {
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'queryAll' || parts[i] === 'queryOne' || parts[i] === 'runQuery' || parts[i] === 'runTransaction') {
        result.push(parts[i]);
        // next part is everything until the matching closing paren/bracket
        // We'll just convert ?s sequentially in the next part's SQL
        i++;
        if (i < parts.length) {
          result.push(parts[i].replace(/\?/g, () => {
            // This won't work properly for sequential counter per statement
            return '?'; // keep for now, handle below
          }));
        }
      } else {
        result.push(parts[i]);
      }
    }
  }

  // Better approach: regex to find template literals with backticks and replace ?
  // Also handle string concatenation patterns
  // We'll do a simple full-file replacement: each query call resets counter
  
  // Find all occurrences of SQL strings (backtick, single, double quoted)
  // and replace ? sequentially within each individual SQL string
  
  let newContent = content;
  
  // Handle backtick template literals: `...SQL with ?...`
  newContent = newContent.replace(/(`[^`]*\?[^`]*`)/g, (match) => {
    return convertPlaceholders(match);
  });
  
  // Handle single-quoted strings with ?
  newContent = newContent.replace(/('[^']*\?[^']*')/g, (match) => {
    return convertPlaceholders(match);
  });
  
  // Handle double-quoted strings with ? (less common in SQL)
  newContent = newContent.replace(/("[^"]*\?[^"]*")/g, (match) => {
    // Skip if it looks like a JSX/HTML string attribute
    if (match.includes('<') || match.includes('>')) return match;
    return convertPlaceholders(match);
  });

  if (newContent !== original) {
    fs.writeFileSync(abs, newContent, 'utf8');
    const count = (original.match(/\?/g) || []).length;
    console.log(`  ✅ Converted ${count} placeholders: ${filePath}`);
  } else {
    console.log(`  ⬜ No changes: ${filePath}`);
  }
}

console.log('Converting SQLite ? → PostgreSQL $N placeholders...\n');
for (const f of FILES) {
  processFile(f);
}
console.log('\nDone!');
