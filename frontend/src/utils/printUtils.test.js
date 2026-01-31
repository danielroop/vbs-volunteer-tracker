import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSafari,
  isIOSSafari,
  getPrintDelay,
  safePrint,
  printInNewWindow,
  createPrintDocument
} from './printUtils';

describe('printUtils', () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;
  const originalRequestAnimationFrame = global.requestAnimationFrame;

  beforeEach(() => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(cb, 0);
      return 1;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // Restore navigator if modified
    if (global.navigator !== originalNavigator) {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true
      });
    }
    global.requestAnimationFrame = originalRequestAnimationFrame;
  });

  describe('isSafari', () => {
    it('should return true for Safari user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        },
        writable: true
      });
      expect(isSafari()).toBe(true);
    });

    it('should return false for Chrome user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        writable: true
      });
      expect(isSafari()).toBe(false);
    });

    it('should return false for Firefox user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
        },
        writable: true
      });
      expect(isSafari()).toBe(false);
    });

    it('should return false when navigator is undefined', () => {
      const originalNav = global.navigator;
      delete global.navigator;
      expect(isSafari()).toBe(false);
      global.navigator = originalNav;
    });
  });

  describe('isIOSSafari', () => {
    it('should return true for iOS Safari user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        },
        writable: true
      });
      expect(isIOSSafari()).toBe(true);
    });

    it('should return true for iPad Safari user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        },
        writable: true
      });
      expect(isIOSSafari()).toBe(true);
    });

    it('should return false for iOS Chrome user agent', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.101 Mobile/15E148 Safari/604.1'
        },
        writable: true
      });
      expect(isIOSSafari()).toBe(false);
    });

    it('should return false for desktop Safari', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        },
        writable: true
      });
      expect(isIOSSafari()).toBe(false);
    });

    it('should return false when navigator is undefined', () => {
      const originalNav = global.navigator;
      delete global.navigator;
      expect(isIOSSafari()).toBe(false);
      global.navigator = originalNav;
    });
  });

  describe('getPrintDelay', () => {
    it('should return 500ms for Safari', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        },
        writable: true
      });
      expect(getPrintDelay()).toBe(500);
    });

    it('should return 500ms for iOS Safari', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        },
        writable: true
      });
      expect(getPrintDelay()).toBe(500);
    });

    it('should return 150ms for Chrome', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        writable: true
      });
      expect(getPrintDelay()).toBe(150);
    });

    it('should return 150ms for Firefox', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
        },
        writable: true
      });
      expect(getPrintDelay()).toBe(150);
    });
  });

  describe('safePrint', () => {
    let mockPrint;
    let mockAddEventListener;
    let mockRemoveEventListener;

    beforeEach(() => {
      mockPrint = vi.fn();
      mockAddEventListener = vi.fn();
      mockRemoveEventListener = vi.fn();

      Object.defineProperty(global, 'window', {
        value: {
          print: mockPrint,
          addEventListener: mockAddEventListener,
          removeEventListener: mockRemoveEventListener
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        writable: true
      });
    });

    it('should call beforePrint callback before printing', async () => {
      const beforePrint = vi.fn();
      const afterPrint = vi.fn();

      const printPromise = safePrint({ beforePrint, afterPrint });

      // Run all timers for requestAnimationFrame and setTimeout
      await vi.runAllTimersAsync();

      expect(beforePrint).toHaveBeenCalled();
      expect(mockPrint).toHaveBeenCalled();
    });

    it('should call afterPrint callback after printing', async () => {
      const beforePrint = vi.fn();
      const afterPrint = vi.fn();

      safePrint({ beforePrint, afterPrint });

      // Run all timers
      await vi.runAllTimersAsync();

      expect(afterPrint).toHaveBeenCalled();
    });

    it('should set up afterprint event listener', async () => {
      const beforePrint = vi.fn();
      const afterPrint = vi.fn();

      safePrint({ beforePrint, afterPrint });

      // Run all timers
      await vi.runAllTimersAsync();

      expect(mockAddEventListener).toHaveBeenCalledWith('afterprint', expect.any(Function));
    });

    it('should work without callbacks', async () => {
      const printPromise = safePrint({});

      await vi.runAllTimersAsync();

      expect(mockPrint).toHaveBeenCalled();
    });
  });

  describe('printInNewWindow', () => {
    let mockPrintWindow;
    let mockWindowOpen;

    beforeEach(() => {
      mockPrintWindow = {
        document: {
          open: vi.fn(),
          write: vi.fn(),
          close: vi.fn(),
          readyState: 'complete'
        },
        focus: vi.fn(),
        print: vi.fn(),
        close: vi.fn(),
        closed: false,
        onload: null
      };

      mockWindowOpen = vi.fn().mockReturnValue(mockPrintWindow);

      Object.defineProperty(global, 'window', {
        value: {
          open: mockWindowOpen
        },
        writable: true
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        writable: true
      });
    });

    it('should open a new window with blank target', () => {
      printInNewWindow('<html><body>Test</body></html>');

      expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank');
    });

    it('should write HTML content to the new window', () => {
      const htmlContent = '<html><body>Test Content</body></html>';
      printInNewWindow(htmlContent);

      expect(mockPrintWindow.document.open).toHaveBeenCalled();
      expect(mockPrintWindow.document.write).toHaveBeenCalledWith(htmlContent);
      expect(mockPrintWindow.document.close).toHaveBeenCalled();
    });

    it('should call onError if popup is blocked', () => {
      mockWindowOpen.mockReturnValue(null);
      const onError = vi.fn();

      printInNewWindow('<html></html>', { onError });

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toContain('blocked');
    });

    it('should trigger print after delay', async () => {
      printInNewWindow('<html></html>');

      await vi.runAllTimersAsync();

      expect(mockPrintWindow.focus).toHaveBeenCalled();
      expect(mockPrintWindow.print).toHaveBeenCalled();
    });

    it('should close window after printing', async () => {
      printInNewWindow('<html></html>');

      await vi.runAllTimersAsync();

      expect(mockPrintWindow.close).toHaveBeenCalled();
    });

    it('should call onComplete after printing', async () => {
      const onComplete = vi.fn();

      printInNewWindow('<html></html>', { onComplete });

      await vi.runAllTimersAsync();

      expect(onComplete).toHaveBeenCalled();
    });

    it('should wait for onload event in Safari', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        },
        writable: true
      });

      printInNewWindow('<html></html>');

      // onload should be set for Safari
      expect(mockPrintWindow.onload).not.toBeNull();

      // Trigger onload
      mockPrintWindow.onload();

      await vi.runAllTimersAsync();

      expect(mockPrintWindow.print).toHaveBeenCalled();
    });
  });

  describe('createPrintDocument', () => {
    it('should create a complete HTML document', () => {
      const result = createPrintDocument({
        title: 'Test Title',
        styles: 'body { color: red; }',
        body: '<h1>Test</h1>'
      });

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html>');
      expect(result).toContain('<head>');
      expect(result).toContain('<body>');
      expect(result).toContain('</html>');
    });

    it('should include the title', () => {
      const result = createPrintDocument({
        title: 'My Document Title',
        styles: '',
        body: ''
      });

      expect(result).toContain('<title>My Document Title</title>');
    });

    it('should include styles in a style tag', () => {
      const result = createPrintDocument({
        title: 'Test',
        styles: '.custom { font-size: 14px; }',
        body: ''
      });

      expect(result).toContain('<style>');
      expect(result).toContain('.custom { font-size: 14px; }');
      expect(result).toContain('</style>');
    });

    it('should include body content', () => {
      const result = createPrintDocument({
        title: 'Test',
        styles: '',
        body: '<div class="content">Hello World</div>'
      });

      expect(result).toContain('<div class="content">Hello World</div>');
    });

    it('should include meta charset', () => {
      const result = createPrintDocument({
        title: 'Test',
        styles: '',
        body: ''
      });

      expect(result).toContain('<meta charset="utf-8">');
    });
  });
});
