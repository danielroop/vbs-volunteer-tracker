
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Use correct path handling
const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, 'service-account.json');

let app;
let serviceAccount;
try {
    serviceAccount = JSON.parse(
        readFileSync(serviceAccountPath, 'utf8')
    );
    console.log('Project ID from service account:', serviceAccount.project_id);
    console.log('Client Email:', serviceAccount.client_email);

    app = initializeApp({
        credential: cert(serviceAccount),
        storageBucket: 'vbs-volunteer-tracker.firebasestorage.app'
    });
} catch (e) {
    console.log('Service account not found or invalid, using default credentials...');
    app = initializeApp({
        storageBucket: 'vbs-volunteer-tracker.firebasestorage.app'
    });
}

const storage = getStorage(app);

const corsConfiguration = [
    {
        origin: [
            'https://vbs-volunteer-tracker.web.app',
            'https://vbs-volunteer-tracker.firebaseapp.com',
            'http://localhost:5173',
            'http://localhost:5000',
            'http://localhost:3000'
        ],
        method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
        responseHeader: ['Authorization', 'Content-Type', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
        maxAgeSeconds: 3600
    }
];

async function checkAndSetCors() {
    try {
        const bucketNames = [
            'vbs-volunteer-tracker.firebasestorage.app',
            'vbs-volunteer-tracker.appspot.com',
            'staging.vbs-volunteer-tracker.appspot.com'
        ];

        console.log('Checking commonly used bucket names...');

        let targetBucket = null;

        for (const name of bucketNames) {
            console.log(`Checking bucket: ${name}`);
            const b = storage.bucket(name);
            try {
                const [exists] = await b.exists();
                if (exists) {
                    console.log(`✅ Found bucket: ${name}`);
                    targetBucket = b;
                    break; // Found one!
                } else {
                    console.log(`❌ Bucket ${name} does not exist.`);
                }
            } catch (err) {
                console.log(`❌ Error checking ${name}: ${err.message}`);
            }
        }

        if (targetBucket) {
            console.log(`Applying CORS configuration to: ${targetBucket.name}`);
            await targetBucket.setCorsConfiguration(corsConfiguration);
            console.log('✅ CORS configuration set successfully!');
            console.log('Allowed Origins:', corsConfiguration[0].origin);
        } else {
            console.error('❌ Could not find any standard storage bucket.');
            console.log('Listing available buckets again to be sure...');
            // Use any bucket to get storage client access if possible
            const someBucket = storage.bucket('any');
            try {
                const [buckets] = await someBucket.storage.getBuckets();
                console.log('Found buckets:', buckets.map(b => b.name));
            } catch (e) {
                console.error('Failed to list buckets:', e.message);
            }
        }

    } catch (error) {
        console.error('❌ Error in checkAndSetCors:', error);
    }
}

checkAndSetCors();
