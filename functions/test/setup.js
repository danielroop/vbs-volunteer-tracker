/**
 * Jest setup for Firebase Cloud Functions tests
 */

// Set timezone for consistent date handling
process.env.TZ = 'America/New_York';

// Mock console methods to reduce noise in test output
// Comment these out when debugging tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
