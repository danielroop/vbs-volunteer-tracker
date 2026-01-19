import React from 'react';

/**
 * Self-Checkout Component
 * Per PRD Section 3.3.1: Self-Service Check-Out Station
 * - Full-screen kiosk mode
 * - Shows hours today + week total
 * - Auto-reset after 5 seconds
 * - Works offline
 */
export default function SelfCheckout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold mb-4">👋 CHECK OUT</h1>
        <p className="text-xl mb-8">Scan your lanyard to check out</p>

        <div className="bg-white rounded-lg p-8 text-gray-900">
          <div id="checkout-qr-reader" className="w-full max-w-md mx-auto"></div>
          <p className="mt-4 text-gray-600">Then return lanyard to bin →</p>
        </div>

        <div className="mt-8 text-lg">
          🟢 Currently: <span className="font-bold">-- students</span>
        </div>
      </div>
    </div>
  );
}
