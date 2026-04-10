import { renderHook } from '@testing-library/react';
import * as dropHandler from '@/hooks/useDropHandler';
import { useDropzone } from 'react-dropzone';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';

jest.mock('react-dropzone', () => ({
  useDropzone: jest.fn(),
}));

jest.mock('@/stores/drawOrDieStore', () => ({
  useDrawOrDieStore: jest.fn(),
}));

const mockedUseDropzone = jest.mocked(useDropzone);
const mockedUseStore = jest.mocked(useDrawOrDieStore);

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: null | (() => void) = null;

  readAsDataURL(file: File) {
    const extension = file.type === 'application/pdf' ? 'pdf' : 'png';
    this.result = `data:${file.type};base64,encoded-${extension}`;
    this.onload?.();
  }
}

describe('useDropHandler', () => {
  let capturedConfig: Parameters<typeof useDropzone>[0] | undefined;
  const store = {
    setImage: jest.fn(),
    setImageBase64: jest.fn(),
    setAdditionalUploads: jest.fn(),
    setMimeType: jest.fn(),
    setPreviewUrl: jest.fn(),
    setPdfText: jest.fn(),
    setUploadValidationError: jest.fn(),
    addToast: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedConfig = undefined;
    mockedUseStore.mockReturnValue(store as never);
    mockedUseDropzone.mockImplementation((config) => {
      capturedConfig = config;
      return { mocked: true } as never;
    });
    global.FileReader = MockFileReader as never;
    global.URL.createObjectURL = jest.fn(() => 'blob:preview-url');
  });

  it('configures the expected accepted file types and limits', () => {
    renderHook(() => dropHandler.useDropHandler());

    expect(capturedConfig?.maxFiles).toBe(8);
    expect(capturedConfig?.multiple).toBe(true);
    expect(capturedConfig?.accept).toEqual({
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    });
  });

  it('handles image uploads by storing the file, mime type, preview, and base64 payload', async () => {
    renderHook(() => dropHandler.useDropHandler());
    const file = new File(['png-data'], 'board.png', { type: 'image/png' });

    await capturedConfig?.onDrop?.([file], [], {} as never);

    expect(store.setImage).toHaveBeenCalledWith(file);
    expect(store.setMimeType).toHaveBeenCalledWith('image/png');
    expect(store.setPreviewUrl).toHaveBeenCalledWith('blob:preview-url');
    expect(store.setPdfText).toHaveBeenCalledWith(null);
    expect(store.setAdditionalUploads).toHaveBeenCalledWith([]);
    expect(store.setImageBase64).toHaveBeenCalledWith('encoded-png');
  });

  it('enforces 35MB total upload limit in Studio Desk', async () => {
    renderHook(() => dropHandler.useDropHandler({ isPremiumUser: false }));

    const oversizedFile = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(oversizedFile, 'size', { value: 36 * 1024 * 1024 });

    await capturedConfig?.onDrop?.([oversizedFile], [], {} as never);

    expect(store.setUploadValidationError).toHaveBeenCalledWith(
      expect.stringContaining('Studio Desk limiti 35 MB')
    );
    expect(store.addToast).toHaveBeenCalledWith(
      expect.stringContaining('Studio Desk limiti 35 MB'),
      'error',
      6500
    );
    expect(store.setImage).toHaveBeenLastCalledWith(null);
  });

  it('allows files up to 35MB for premium users', async () => {
    renderHook(() => dropHandler.useDropHandler({ isPremiumUser: true }));

    const premiumFile = new File(['premium-data'], 'premium.png', { type: 'image/png' });
    Object.defineProperty(premiumFile, 'size', { value: 20 * 1024 * 1024 });

    await capturedConfig?.onDrop?.([premiumFile], [], {} as never);

    expect(store.setImage).toHaveBeenCalledWith(premiumFile);
    expect(store.setUploadValidationError).toHaveBeenCalledWith(null);
    expect(store.setAdditionalUploads).toHaveBeenCalledWith([]);
    expect(store.setImageBase64).toHaveBeenCalledWith('encoded-png');
  });

  it('rejects pdf uploads when signature is invalid', async () => {
    renderHook(() => dropHandler.useDropHandler());
    const file = new File(['not-a-real-pdf'], 'jury.pdf', { type: 'application/pdf' });

    await capturedConfig?.onDrop?.([file], [], {} as never);

    expect(store.setImage).toHaveBeenCalledWith(file);
    expect(store.setMimeType).toHaveBeenCalledWith('application/pdf');
    expect(store.addToast).toHaveBeenCalledWith('PDF işlenemedi. Lütfen farklı bir dosya deneyin.', 'error');
    expect(store.setImage).toHaveBeenLastCalledWith(null);
    expect(store.setImageBase64).toHaveBeenCalledWith(null);
  });

  it('extracts text from supported pdf files', async () => {
    const originalArrayBuffer = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = jest.fn(async function (this: File) {
      return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0]).buffer;
    }) as never;

    jest.spyOn(dropHandler.pdfWorkerLoader, 'loadPdfjsModule').mockResolvedValue({
      version: '5.5.207',
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: jest.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          getPage: jest.fn().mockResolvedValue({
            getTextContent: jest.fn().mockResolvedValue({
              items: [{ str: 'Pafta notu' }],
            }),
          }),
        }),
      }),
    } as never);

    const text = await dropHandler.extractPdfTextWithPdfjs(
      new File(['%PDF-1.7'], 'jury.pdf', { type: 'application/pdf' })
    );

    expect(text).toBe('Pafta notu');
    File.prototype.arrayBuffer = originalArrayBuffer;
    jest.restoreAllMocks();
  });

});
