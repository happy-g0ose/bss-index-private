// Test comment to trigger automated deployment notification check
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE || '';
let commitAuthor = process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME || '';
let commitSha = process.env.VERCEL_GIT_COMMIT_SHA || '';

if (!commitMessage || !commitSha) {
  try {
    commitMessage = execSync('git log -1 --pretty=%B').toString().trim();
    commitAuthor = execSync('git log -1 --pretty=%an').toString().trim();
    commitSha = execSync('git log -1 --pretty=%H').toString().trim();
  } catch (e) {
    // Fallback if git is not available
  }
}

// Release version, kept in a plain VERSION file so the site, the build meta
// and the Discord bot all read the same single source of truth.
let version = '0.0.0';
try {
  version = fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf-8').trim() || version;
} catch (e) {
  // VERSION file missing - keep the fallback
}

const buildMeta = {
  timestamp: Date.now(),
  version,
  message: commitMessage || 'Локальная сборка / Ручное обновление',
  author: commitAuthor || 'Разработчик',
  sha: commitSha || 'dev'
};

const dir = path.join(__dirname, 'public');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(
  path.join(dir, 'build-meta.json'),
  JSON.stringify(buildMeta, null, 2),
  'utf-8'
);
console.log('Generated build-meta.json successfully!');
