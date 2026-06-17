#!/usr/bin/env node
/**
 * backup-vbs2026-jun13.js
 *
 * Exports all VBS 2026 time entries from 2026-06-13, the event document,
 * and associated student records to a local JSON file for safekeeping.
 *
 * Usage:
 *   node scripts/backup-vbs2026-jun13.js --service-account scripts/service-account.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const EVENT_ID = 'Wiz2Cfwf4beupe92NW54';
const TARGET_DATE = '2026-06-13';

function parseArgs(argv) {
  const options = { serviceAccount: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--service-account') options.serviceAccount = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: node backup-vbs2026-jun13.js --service-account <path>');
      process.exit(0);
    }
  }
  if (!options.serviceAccount) throw new Error('Missing --service-account path.');
  return options;
}

function initFirebase(serviceAccountPath) {
  if (getApps().length) return;
  const sa = JSON.parse(readFileSync(resolve(serviceAccountPath), 'utf8'));
  initializeApp({ credential: cert(sa), projectId: 'vbs-volunteer-tracker' });
}

function serializeDoc(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toMillis === 'function') {
      out[k] = {
        _type: 'Timestamp',
        _seconds: v.seconds,
        _nanoseconds: v.nanoseconds,
        _iso: v.toDate().toISOString(),
      };
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  initFirebase(options.serviceAccount);
  const db = getFirestore();

  console.log(`Fetching VBS 2026 event (${EVENT_ID})...`);
  const eventDoc = await db.collection('events').doc(EVENT_ID).get();
  if (!eventDoc.exists) throw new Error(`Event not found: ${EVENT_ID}`);
  const eventData = { id: eventDoc.id, ...serializeDoc(eventDoc.data()) };

  console.log(`Fetching time entries for ${TARGET_DATE}...`);
  const entriesSnap = await db.collection('timeEntries')
    .where('eventId', '==', EVENT_ID)
    .where('date', '==', TARGET_DATE)
    .get();

  const timeEntries = entriesSnap.docs.map(doc => ({ id: doc.id, ...serializeDoc(doc.data()) }));
  console.log(`Found ${timeEntries.length} time entries.`);

  const studentIds = [...new Set(timeEntries.map(e => e.studentId).filter(Boolean))];
  console.log(`Fetching ${studentIds.length} student records...`);
  const students = [];
  for (let i = 0; i < studentIds.length; i += 100) {
    const docs = await Promise.all(
      studentIds.slice(i, i + 100).map(id => db.collection('students').doc(id).get())
    );
    docs.forEach(doc => {
      if (doc.exists) students.push({ id: doc.id, ...serializeDoc(doc.data()) });
    });
  }

  const backup = {
    exportedAt: new Date().toISOString(),
    eventId: EVENT_ID,
    date: TARGET_DATE,
    event: eventData,
    students,
    timeEntries,
  };

  const outPath = resolve(`data/backup-vbs2026-${TARGET_DATE}.json`);
  writeFileSync(outPath, JSON.stringify(backup, null, 2));

  console.log(`\nBackup saved to: ${outPath}`);
  console.log(`  Event: ${eventData.name}`);
  console.log(`  Students: ${students.length}`);
  console.log(`  Time entries: ${timeEntries.length}`);

  const byActivity = {};
  timeEntries.forEach(e => {
    byActivity[e.activityId] = (byActivity[e.activityId] || 0) + 1;
  });
  Object.entries(byActivity).forEach(([activity, count]) => {
    console.log(`    ${activity}: ${count}`);
  });
}

main().catch(err => {
  console.error(`\nFailed: ${err.message}`);
  process.exit(1);
});
