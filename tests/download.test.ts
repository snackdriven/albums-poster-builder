import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob } from '../client/src/export';

describe('downloadBlob', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers();
    // Save original URL functions just in case
    if (globalThis.URL) {
      originalCreateObjectURL = globalThis.URL.createObjectURL;
      originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    if (globalThis.URL) {
      if (originalCreateObjectURL) globalThis.URL.createObjectURL = originalCreateObjectURL;
      if (originalRevokeObjectURL) globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it('downloads a blob with the correct filename', () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-url');
    const mockRevokeObjectURL = vi.fn();

    // Stub URL methods securely
    vi.stubGlobal('URL', {
      ...globalThis.URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
    };

    const mockCreateElement = vi.fn((tagName) => {
      if (tagName === 'a') {
        return mockLink as any as HTMLAnchorElement;
      }
      return {} as any;
    });

    const mockAppend = vi.fn();

    // Stub document
    vi.stubGlobal('document', {
      createElement: mockCreateElement,
      body: {
        append: mockAppend,
      },
    });

    const dummyBlob = new Blob(['dummy content'], { type: 'text/plain' });
    downloadBlob(dummyBlob, 'test.txt');

    expect(mockCreateObjectURL).toHaveBeenCalledWith(dummyBlob);
    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockLink.href).toBe('blob:http://localhost/mock-url');
    expect(mockLink.download).toBe('test.txt');

    expect(mockAppend).toHaveBeenCalledWith(mockLink);
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.remove).toHaveBeenCalled();

    expect(mockRevokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-url');
  });
});
