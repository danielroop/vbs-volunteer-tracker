/**
 * Print Utilities - Safari Compatible
 *
 * Safari has specific timing requirements for print functionality:
 * 1. Needs longer delays for content to render before window.print()
 * 2. window.open() + print() requires proper load event handling
 * 3. CSS @media print rules need time to apply
 *
 * This utility provides browser-compatible print functions.
 */

/**
 * Detect if the browser is Safari
 * @returns {boolean} true if Safari browser
 */
export const isSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
};

/**
 * Detect if the browser is iOS Safari (more restrictive)
 * @returns {boolean} true if iOS Safari
 */
export const isIOSSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isChrome = /CriOS/.test(ua);
  return isIOS && isWebkit && !isChrome;
};

/**
 * Get appropriate print delay based on browser
 * Safari needs more time to render content before printing
 * @returns {number} delay in milliseconds
 */
export const getPrintDelay = () => {
  if (isSafari() || isIOSSafari()) {
    return 500; // Safari needs more time
  }
  return 150; // Chrome, Firefox, etc.
};

/**
 * Wait for the next animation frame plus a delay
 * This ensures DOM updates are complete before printing
 * @param {number} delay - additional delay in ms
 * @returns {Promise<void>}
 */
const waitForRender = (delay) => {
  return new Promise(resolve => {
    // Use requestAnimationFrame to ensure paint is complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, delay);
      });
    });
  });
};

/**
 * Print the current page with proper timing for all browsers
 * Use this instead of direct window.print() calls
 *
 * @param {Object} options
 * @param {Function} options.beforePrint - Function to call before printing (e.g., set print mode state)
 * @param {Function} options.afterPrint - Function to call after printing (e.g., reset print mode state)
 * @returns {Promise<void>}
 */
export const safePrint = async ({ beforePrint, afterPrint }) => {
  // Call beforePrint to set up print mode
  if (beforePrint) {
    await beforePrint();
  }

  // Wait for DOM to update
  const delay = getPrintDelay();
  await waitForRender(delay);

  // Trigger print
  window.print();

  // Safari doesn't always fire afterprint event reliably
  // Use a combination of event listener and timeout
  const cleanup = () => {
    if (afterPrint) {
      afterPrint();
    }
  };

  // Set up afterprint listener
  const handleAfterPrint = () => {
    window.removeEventListener('afterprint', handleAfterPrint);
    cleanup();
  };

  window.addEventListener('afterprint', handleAfterPrint);

  // Fallback timeout for browsers that don't fire afterprint (older Safari)
  setTimeout(() => {
    window.removeEventListener('afterprint', handleAfterPrint);
    cleanup();
  }, isSafari() ? 2000 : 1000);
};

/**
 * Open a new window with HTML content and print it
 * Used for PDF exports. Safari-compatible implementation.
 *
 * @param {string} htmlContent - Complete HTML document string
 * @param {Object} options
 * @param {Function} options.onComplete - Called when print is complete or cancelled
 * @param {Function} options.onError - Called if an error occurs
 * @returns {void}
 */
export const printInNewWindow = (htmlContent, { onComplete, onError } = {}) => {
  try {
    // Create the new window
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      // Popup was blocked
      const error = new Error('Print window was blocked. Please allow popups for this site.');
      if (onError) onError(error);
      return;
    }

    // Write content to the new window
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Safari needs to wait for images and fonts to load
    const triggerPrint = () => {
      printWindow.focus();

      // Use setTimeout to ensure Safari has fully parsed CSS
      const delay = getPrintDelay();
      setTimeout(() => {
        try {
          printWindow.print();

          // Close the window after printing
          // Safari may need a delay before closing
          setTimeout(() => {
            printWindow.close();
            if (onComplete) onComplete();
          }, isSafari() ? 500 : 100);
        } catch (err) {
          if (onError) onError(err);
          printWindow.close();
        }
      }, delay);
    };

    // For Safari, we need to wait for the load event
    if (isSafari() || isIOSSafari()) {
      // Safari: wait for load event
      printWindow.onload = triggerPrint;

      // Fallback if load event doesn't fire (can happen with simple content)
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          triggerPrint();
        }
      }, 1000);
    } else {
      // Chrome/Firefox: can proceed faster
      if (printWindow.document.readyState === 'complete') {
        triggerPrint();
      } else {
        printWindow.onload = triggerPrint;
      }
    }
  } catch (error) {
    if (onError) onError(error);
  }
};

/**
 * Create a print-ready HTML document with proper styling
 * @param {Object} options
 * @param {string} options.title - Document title
 * @param {string} options.styles - CSS styles to include
 * @param {string} options.body - HTML body content
 * @returns {string} Complete HTML document
 */
export const createPrintDocument = ({ title, styles, body }) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        ${styles}
      </style>
    </head>
    <body>
      ${body}
    </body>
    </html>
  `;
};

export default {
  isSafari,
  isIOSSafari,
  getPrintDelay,
  safePrint,
  printInNewWindow,
  createPrintDocument
};
