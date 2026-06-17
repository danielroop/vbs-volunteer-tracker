#!/usr/bin/env node
/**
 * backup-vbs2026-full.js
 *
 * Exports the full VBS 2026 event data set to a local JSON file:
 * - event document
 * - all eventStudents links for the event
 * - all timeEntries for the event
 * - all students referenced by roster links or time entries
 * - students with a legacy eventId field matching the event
 * - global pdfTemplates and settings/pdfDefaults used by reports
 *
 * Usage:
 *   node scripts/backup-vbs2026-full.js --service-account scripts/service-account.json
 *   node scripts/backup-vbs2026-full.js --service-account scripts/service-account.json --event-id Wiz2Cfwf4beupe92NW54
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEFAULT_PROJECT_ID = 'vbs-volunteer-tracker';
const DEFAULT_EVENT_ID = 'Wiz2Cfwf4beupe92NW54';

function parseArgs(argv) {
  const options = {
    serviceAccount: null,
    projectId: DEFAULT_PROJECT_ID,
    eventId: DEFAULT_EVENT_ID,
    out: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];

    if (arg === '--service-account') options.serviceAccount = next();
    else if (arg === '--project') options.projectId = next();
    else if (arg === '--event-id') options.eventId = next();
    else if (arg === '--out') options.out = next();
    else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.serviceAccount) throw new Error('Missing --service-account path.');
  if (!options.eventId) throw new Error('Missing --event-id.');
  return options;
}

function printUsage() {
  console.log(`
Usage:
  node scripts/backup-vbs2026-full.js \\
    --service-account scripts/service-account.json \\
    [--event-id ${DEFAULT_EVENT_ID}] \\
    [--project ${DEFAULT_PROJECT_ID}] \\
    [--out data/backup-vbs2026-full.json]

This script is read-only against Firestore. It writes one local JSON backup file.
`);
}

function initFirebase(options) {
  if (getApps().length) return;
  const sa = JSON.parse(readFileSync(resolve(options.serviceAccount), 'utf8'));
  initializeApp({
    credential: cert(sa),
    projectId: options.projectId,
  });
}

function serializeValue(value) {
  if (value == null) return value;

  if (typeof value.toMillis === 'function' && typeof value.toDate === 'function') {
    return {
      _type: 'Timestamp',
      _seconds: value.seconds,
      _nanoseconds: value.nanoseconds,
      _iso: value.toDate().toISOString(),
    };
  }

  if (typeof value.path === 'string' && value.firestore) {
    return {
      _type: 'DocumentReference',
      path: value.path,
    };
  }

  if (Array.isArray(value)) return value.map(serializeValue);

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeValue(nestedValue)])
    );
  }

  return value;
}

function serializeDoc(doc) {
  return {
    id: doc.id,
    ...serializeValue(doc.data()),
  };
}

async function fetchQuery(label, query) {
  console.log(`Fetching ${label}...`);
  const snap = await query.get();
  const docs = snap.docs.map(serializeDoc);
  console.log(`  ${docs.length} ${label}`);
  return docs;
}

async function fetchDocsById(db, collectionName, ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))].sort();
  const docs = [];

  console.log(`Fetching ${uniqueIds.length} referenced ${collectionName} record(s)...`);
  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100);
    const snapshots = await Promise.all(
      chunk.map(id => db.collection(collectionName).doc(id).get())
    );
    snapshots.forEach(snapshot => {
      if (snapshot.exists) docs.push(serializeDoc(snapshot));
    });
    console.log(`  checked ${Math.min(i + chunk.length, uniqueIds.length)}/${uniqueIds.length}`);
  }

  return docs;
}

function mergeDocsById(...docGroups) {
  const byId = new Map();
  docGroups.flat().forEach(doc => byId.set(doc.id, doc));
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] || '(blank)';
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function defaultOutPath(eventId, exportedAt) {
  const safeDatetime = exportedAt.replace(/[:.]/g, '-');
  return `data/backup-vbs2026-full-${eventId}-${safeDatetime}.json`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  initFirebase(options);
  const db = getFirestore();
  const exportedAt = new Date().toISOString();

  console.log(`Fetching VBS 2026 event (${options.eventId})...`);
  const eventDoc = await db.collection('events').doc(options.eventId).get();
  if (!eventDoc.exists) throw new Error(`Event not found: ${options.eventId}`);
  const event = serializeDoc(eventDoc);
  console.log(`  Event: ${event.name || options.eventId}`);

  const eventStudents = await fetchQuery(
    'eventStudents',
    db.collection('eventStudents').where('eventId', '==', options.eventId)
  );

  const timeEntries = await fetchQuery(
    'timeEntries',
    db.collection('timeEntries').where('eventId', '==', options.eventId)
  );

  const legacyEventStudents = await fetchQuery(
    'legacy students with matching eventId',
    db.collection('students').where('eventId', '==', options.eventId)
  );

  const referencedStudentIds = [
    ...eventStudents.map(link => link.studentId),
    ...timeEntries.map(entry => entry.studentId),
    ...legacyEventStudents.map(student => student.id),
  ];
  const referencedStudents = await fetchDocsById(db, 'students', referencedStudentIds);
  const students = mergeDocsById(referencedStudents, legacyEventStudents);

  const pdfTemplates = await fetchQuery('pdfTemplates', db.collection('pdfTemplates'));

  console.log('Fetching settings/pdfDefaults...');
  const pdfDefaultsDoc = await db.collection('settings').doc('pdfDefaults').get();
  const settings = {
    pdfDefaults: pdfDefaultsDoc.exists ? serializeDoc(pdfDefaultsDoc) : null,
  };
  console.log(`  settings/pdfDefaults: ${pdfDefaultsDoc.exists ? 'found' : 'missing'}`);

  const backup = {
    backupType: 'vbs2026-full-event',
    exportedAt,
    projectId: options.projectId,
    eventId: options.eventId,
    event,
    eventStudents,
    students,
    timeEntries,
    relatedGlobals: {
      pdfTemplates,
      settings,
    },
    summary: {
      eventStudents: eventStudents.length,
      students: students.length,
      timeEntries: timeEntries.length,
      pdfTemplates: pdfTemplates.length,
      timeEntriesByDate: countBy(timeEntries, 'date'),
      timeEntriesByActivity: countBy(timeEntries, 'activityId'),
    },
  };

  const outPath = resolve(options.out || defaultOutPath(options.eventId, exportedAt));
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(backup, null, 2));

  console.log(`\nBackup saved to: ${outPath}`);
  console.log(`  Event: ${event.name || options.eventId}`);
  console.log(`  Roster links: ${eventStudents.length}`);
  console.log(`  Students: ${students.length}`);
  console.log(`  Time entries: ${timeEntries.length}`);
  console.log(`  PDF templates: ${pdfTemplates.length}`);
  console.log('  Time entries by activity:');
  Object.entries(backup.summary.timeEntriesByActivity)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([activity, count]) => console.log(`    ${activity}: ${count}`));
}

main().catch(err => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
