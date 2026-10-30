import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'src', 'blog-data.json');

function verify() {
  console.log('--- Verifying Blog Data Integrity & Word Counts ---');
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`ERROR: ${DATA_FILE} does not exist!`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const articles = JSON.parse(raw);

  console.log(`Loaded ${articles.length} articles from ${DATA_FILE}`);

  if (articles.length < 132) {
    console.error(`FAILED: Expected at least 132 articles, found ${articles.length}`);
    process.exit(1);
  }

  const slugs = new Set();
  let failCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    if (slugs.has(a.slug)) {
      console.error(`COLLISION: Duplicate slug found: ${a.slug}`);
      failCount++;
    }
    slugs.add(a.slug);

    const words = a.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
    if (words < 2500) {
      console.error(`FAIL: Article #${i + 1} (${a.slug}) has ${words} words (Required: >= 2500)`);
      failCount++;
    }
  }

  if (failCount > 0) {
    console.error(`\n❌ VERIFICATION FAILED: ${failCount} errors detected.`);
    process.exit(1);
  }

  console.log(`\n✅ ALL ${articles.length} ARTICLES PASSED 100% INTEGRITY & 2,500+ WORD COUNT INVARIANT!`);
}

verify();
