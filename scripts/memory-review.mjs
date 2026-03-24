#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const memoryDir = path.join(projectRoot, '.codex', 'memories');
const files = {
  profile: path.join(memoryDir, 'PROFILE.md'),
  active: path.join(memoryDir, 'ACTIVE.md'),
  learnings: path.join(memoryDir, 'LEARNINGS.md'),
  errors: path.join(memoryDir, 'ERRORS.md'),
  featureRequests: path.join(memoryDir, 'FEATURE_REQUESTS.md'),
  reviewLog: path.join(memoryDir, 'REVIEW_LOG.md'),
};

const MAX_ENTRY_LINES = 300;

function ensureFile(filePath, fallbackContent) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, fallbackContent, 'utf8');
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function normalizeEntries(content) {
  const lines = content.split('\n');
  const seen = new Set();
  const out = [];
  let keptEntryLines = 0;
  let inEntriesSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+Entries\b/.test(trimmed)) {
      inEntriesSection = true;
      out.push(line);
      continue;
    }
    if (/^##\s+/.test(trimmed) && !/^##\s+Entries\b/.test(trimmed)) {
      inEntriesSection = false;
      out.push(line);
      continue;
    }

    const isEntry = trimmed.startsWith('- ');
    if (!inEntriesSection || !isEntry) {
      out.push(line);
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    keptEntryLines += 1;
    if (keptEntryLines > MAX_ENTRY_LINES) {
      continue;
    }
    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function extractPromoteEntries(content) {
  const lines = content.split('\n');
  const promoteEntries = [];
  let inEntriesSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+Entries\b/.test(trimmed)) {
      inEntriesSection = true;
      continue;
    }
    if (/^##\s+/.test(trimmed) && !/^##\s+Entries\b/.test(trimmed)) {
      inEntriesSection = false;
      continue;
    }
    if (!inEntriesSection) {
      continue;
    }
    if (!trimmed.startsWith('- ') || !/#promote\b/.test(trimmed)) {
      continue;
    }
    promoteEntries.push(trimmed.replace(/\s+#promote\b/g, ''));
  }

  return promoteEntries;
}

function appendMissingActiveEntries(activeContent, promoteEntries) {
  if (promoteEntries.length === 0) {
    return activeContent;
  }

  const activeLines = activeContent.split('\n');
  const activeSet = new Set(activeLines.map((line) => line.trim()));
  const additions = [];

  for (const entry of promoteEntries) {
    if (!activeSet.has(entry)) {
      additions.push(entry);
    }
  }

  if (additions.length === 0) {
    return activeContent;
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const sectionHeader = `\n## Auto Promoted (${now})\n`;
  return `${activeContent.trimEnd()}${sectionHeader}\n${additions.join('\n')}\n`;
}

function appendReviewLog(logPath, message) {
  const now = new Date().toISOString();
  fs.appendFileSync(logPath, `- ${now}: ${message}\n`, 'utf8');
}

function run() {
  ensureFile(files.profile, '# PROFILE\n');
  ensureFile(files.active, '# ACTIVE\n');
  ensureFile(files.learnings, '# LEARNINGS\n\n## Entries\n');
  ensureFile(files.errors, '# ERRORS\n\n## Entries\n');
  ensureFile(files.featureRequests, '# FEATURE_REQUESTS\n\n## Entries\n');
  ensureFile(files.reviewLog, '# REVIEW_LOG\n');

  const learningsRaw = read(files.learnings);
  const errorsRaw = read(files.errors);
  const featureRaw = read(files.featureRequests);
  const activeRaw = read(files.active);

  const learningsNormalized = normalizeEntries(learningsRaw);
  const errorsNormalized = normalizeEntries(errorsRaw);
  const featureNormalized = normalizeEntries(featureRaw);

  const promoteEntries = [
    ...extractPromoteEntries(learningsNormalized),
    ...extractPromoteEntries(errorsNormalized),
  ];

  const activeNext = appendMissingActiveEntries(activeRaw, promoteEntries);

  write(files.learnings, learningsNormalized);
  write(files.errors, errorsNormalized);
  write(files.featureRequests, featureNormalized);
  write(files.active, activeNext.endsWith('\n') ? activeNext : `${activeNext}\n`);

  appendReviewLog(
    files.reviewLog,
    `hourly-review completed, promoted=${promoteEntries.length}`
  );

  process.stdout.write(
    `memory-review done: promoted=${promoteEntries.length}\n`
  );
}

run();
