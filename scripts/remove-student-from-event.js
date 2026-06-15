#!/usr/bin/env node

/**
 * Remove a specific student from a specific event by deleting their eventStudents link.
 * Does NOT delete the student record itself.
 *
 * Usage:
 *   node remove-student-from-event.js --first "Mason" --last "Allgire" --event "VBS 2026 - Test"
 *   node remove-student-from-event.js --first "Mason" --last "Allgire" --event-id <eventId>
 *   Add --dry-run to preview without making changes.
 */

import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function parseArgs(argv) {
  const opts = { firstName: null, lastName: null, eventName: null, eventId: null, dryRun: false, serviceAccount: null };
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i];
    if (argv[i] === '--first') opts.firstName = next();
    else if (argv[i] === '--last') opts.lastName = next();
    else if (argv[i] === '--event') opts.eventName = next();
    else if (argv[i] === '--event-id') opts.eventId = next();
    else if (argv[i] === '--service-account') opts.serviceAccount = next();
    else if (argv[i] === '--dry-run') opts.dryRun = true;
  }
  if (!opts.firstName || !opts.lastName) throw new Error('--first and --last are required');
  if (!opts.eventName && !opts.eventId) throw new Error('--event or --event-id is required');
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

const serviceAccountPath = opts.serviceAccount ?? new URL('service-account.json', import.meta.url).pathname;
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  // 1. Resolve event
  let eventId = opts.eventId;
  let eventName = opts.eventName;

  if (!eventId) {
    const eventsSnap = await db.collection('events').get();
    const match = eventsSnap.docs.find(d => d.data().name === eventName);
    if (!match) {
      const names = eventsSnap.docs.map(d => d.data().name).join(', ');
      throw new Error(`Event "${eventName}" not found. Available events: ${names}`);
    }
    eventId = match.id;
    eventName = match.data().name;
  } else {
    const doc = await db.collection('events').doc(eventId).get();
    if (!doc.exists) throw new Error(`Event ID not found: ${eventId}`);
    eventName = doc.data().name;
  }
  console.log(`Event: ${eventName} (${eventId})`);

  // 2. Find the student
  const studentsSnap = await db.collection('students')
    .where('firstName', '==', opts.firstName)
    .where('lastName', '==', opts.lastName)
    .get();

  if (studentsSnap.empty) {
    throw new Error(`No student found with name "${opts.firstName} ${opts.lastName}"`);
  }
  if (studentsSnap.size > 1) {
    const ids = studentsSnap.docs.map(d => d.id).join(', ');
    throw new Error(`Multiple students matched "${opts.firstName} ${opts.lastName}": ${ids} — use --event-id to be more specific or resolve manually`);
  }

  const studentDoc = studentsSnap.docs[0];
  const studentId = studentDoc.id;
  const studentData = studentDoc.data();
  console.log(`Student: ${studentData.firstName} ${studentData.lastName} (${studentId})`);

  // 3. Find eventStudents link
  const linkSnap = await db.collection('eventStudents')
    .where('eventId', '==', eventId)
    .where('studentId', '==', studentId)
    .get();

  if (linkSnap.empty) {
    console.log(`No eventStudents link found — student is not enrolled in this event.`);
    return;
  }

  console.log(`Found ${linkSnap.size} eventStudents link(s) to remove.`);

  // 4. Check for time entries
  const entriesSnap = await db.collection('timeEntries')
    .where('eventId', '==', eventId)
    .where('studentId', '==', studentId)
    .get();

  if (!entriesSnap.empty) {
    console.log(`\nTime entries to delete (${entriesSnap.size}):`);
    entriesSnap.docs.forEach(d => {
      const e = d.data();
      console.log(`  - Entry ${d.id}: checkIn=${e.checkInTime?.toDate?.()}, status=${e.status}`);
    });
  }

  if (opts.dryRun) {
    console.log(`\n[dry-run] Would delete ${linkSnap.size} eventStudents link(s) and ${entriesSnap.size} time entry/entries. No changes made.`);
    return;
  }

  // 5. Delete the link(s) and time entries
  const batch = db.batch();
  linkSnap.docs.forEach(d => batch.delete(d.ref));
  entriesSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`Removed ${linkSnap.size} eventStudents link(s) and ${entriesSnap.size} time entry/entries. Mason Allgire has been fully removed from "${eventName}".`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
