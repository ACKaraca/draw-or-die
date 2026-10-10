/**
 * useDropHandler.ts
 *
 * Encapsulates the react-dropzone onDrop handler.
 * Reads/writes to the drawOrDieStore for all image-related state.
 */
'use client';

import { useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import { reportClientError } from '@/lib/logger';
import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

const STUDIO_TOTAL_MAX_FILE_SIZE_BYTES = 35 * 1024 * 1024;
const STUDIO_MAX_FILES = 8;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const PDF_TEXT_TIMEOUT_MS = 7000;
const PDF_SECURITY_SCAN_TIMEOUT_MS = 3000;

interface UseDropHandlerOptions {
  isPremiumUser?: boolean;
  /** @deprecated Upload messages follow the runtime UI language (useLanguage); kept for API compatibility. */
  preferredLanguage?: SupportedLanguage;
}

const MAX_LISTED_REJECTED_FILES = 3;

function describeRejectedFiles(rejections: FileRejection[], language: SupportedLanguage, maxTotalSizeMb: number): string {
  const codes = new Set(rejections.flatMap((entry) => entry.errors.map((error) => error.code)));

  if (codes.has('too-many-files')) {
    return pickLocalized(
      language,
      `Studio Desk en fazla ${STUDIO_MAX_FILES} dosya kabul eder. Daha az dosya seçip tekrar yükleyin.`,
      `Studio Desk accepts at most ${STUDIO_MAX_FILES} files. Select fewer files and upload again.`,
    );
  }

  const names = rejections.slice(0, MAX_LISTED_REJECTED_FILES).map((entry) => entry.file.name).join(', ');
  const extraCount = rejections.length - MAX_LISTED_REJECTED_FILES;
  const fileList = extraCount > 0 ? `${names} +${extraCount}` : names;

  if (codes.has('file-invalid-type')) {
    return pickLocalized(
      language,
      `Desteklenmeyen dosya türü: ${fileList}. Sadece JPG, PNG veya PDF yükleyebilirsiniz.`,
      `Unsupported file type: ${fileList}. You can only upload JPG, PNG, or PDF files.`,
    );
  }

  if (codes.has('file-too-large')) {
    return pickLocalized(
      language,
      `Dosya çok büyük: ${fileList}. Studio Desk limiti toplam ${maxTotalSizeMb} MB. Dosyayı küçültüp tekrar yükleyin.`,
      `File is too large: ${fileList}. Studio Desk limit is ${maxTotalSizeMb} MB in total. Reduce the file and upload again.`,
    );
  }

  return pickLocalized(
    language,
    `Dosya kabul edilmedi: ${fileList}. JPG, PNG veya PDF seçip tekrar yükleyin.`,
    `File was not accepted: ${fileList}. Choose a JPG, PNG, or PDF and upload again.`,
  );
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('File could not be read.'));
    reader.readAsDataURL(file);
  });
}

export async function loadPdfjsModule() {
  return import('pdfjs-dist');
}

export const pdfWorkerLoader = {
  loadPdfjsModule,
};

export async function extractPdfTextWithPdfjs(file: File): Promise<string | null> {
  const pdfjs = await pdfWorkerLoader.loadPdfjsModule();
  const arrayBuffer = await file.arrayBuffer();
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const maxPages = Math.min(pdf.numPages, 3);
    const pagesText: string[] = [];

    for (let pageIndex = 1; pageIndex <= maxPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .trim();
      if (text) pagesText.push(text);
    }

    const combined = pagesText.join(' ').trim();
    return combined || null;
  } catch (error) {
    console.warn('PDF metin çıkarımı başarısız, görsel analiz ile devam ediliyor', error);
    return null;
  }
}

async function validatePdfMagicBytes(file: File): Promise<boolean> {
  const signatureBuffer = await file.slice(0, 4).arrayBuffer();
  const signature = new Uint8Array(signatureBuffer);
  return (
    signature.length >= 4 &&
    signature[0] === 0x25 &&
    signature[1] === 0x50 &&
    signature[2] === 0x44 &&
    signature[3] === 0x46
  );
}

type PdfRiskFlag = 'javascript' | 'auto-run' | 'form-actions';

function localizePdfRiskFlag(flag: PdfRiskFlag, language: SupportedLanguage): string {
  switch (flag) {
    case 'javascript':
      return 'JavaScript';
    case 'auto-run':
      return pickLocalized(language, 'otomatik çalıştırma / gömülü içerik', 'auto-run / embedded content');
    case 'form-actions':
      return pickLocalized(language, 'form aksiyonları', 'form actions');
    default: {
      const _exhaustive: never = flag;
      throw new Error(`Unknown PDF risk flag: ${String(_exhaustive)}`);
    }
  }
}

async function detectSuspiciousPdfContent(file: File): Promise<PdfRiskFlag[]> {
  const scanBuffer = await file.slice(0, 1024 * 1024).arrayBuffer();
  const scanText = new TextDecoder('latin1').decode(scanBuffer);
  const signatures: Array<{ regex: RegExp; message: PdfRiskFlag }> = [
    { regex: /\/JavaScript|\/JS/gi, message: 'javascript' },
    { regex: /\/EmbeddedFile|\/OpenAction|\/Launch/gi, message: 'auto-run' },
    { regex: /\/SubmitForm|\/ImportData|\/AcroForm/gi, message: 'form-actions' },
  ];
  return signatures.filter((s) => s.regex.test(scanText)).map((s) => s.message);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function runOptionalPdfTask<T>(
  task: Promise<T>,
  fallback: T,
  timeoutMs: number,
  label: string
): Promise<T> {
  try {
    return await withTimeout(task, timeoutMs, label);
  } catch (error) {
    console.warn(`[pdf] ${label} atlandı`, error);
    return fallback;
  }
}

export function useDropHandler(_options: UseDropHandlerOptions = {}) {
  const language = useLanguage();
  const maxTotalSizeMb = Math.round((STUDIO_TOTAL_MAX_FILE_SIZE_BYTES / (1024 * 1024)) * 10) / 10;

  const {
    setImage,
    setImageBase64,
    setAdditionalUploads,
    setMimeType,
    setPreviewUrl,
    setPdfText,
    setUploadValidationError,
    addToast,
  } = useDrawOrDieStore();

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[] = []) => {
    // Rejected drops (wrong type, too many files) are reported by onDropRejected.
    if (acceptedFiles.length === 0 || fileRejections.length > 0) return;

    const clearUploadState = () => {
      setImage(null);
      setImageBase64(null);
      setAdditionalUploads([]);
      setMimeType(null);
      setPreviewUrl(null);
      setPdfText(null);
    };

    if (acceptedFiles.length > STUDIO_MAX_FILES) {
      const message = pickLocalized(language, `Studio Desk en fazla ${STUDIO_MAX_FILES} dosya kabul eder.`, `Studio Desk accepts at most ${STUDIO_MAX_FILES} files.`);
      setUploadValidationError(message);
      addToast(message, 'error');
      clearUploadState();
      return;
    }

    const invalidMime = acceptedFiles.find((file) => !ALLOWED_MIME_TYPES.has(file.type));
    if (invalidMime) {
      const message = pickLocalized(language, 'Sadece JPG, PNG veya PDF yükleyebilirsiniz.', 'You can only upload JPG, PNG, or PDF files.');
      setUploadValidationError(message);
      addToast(message, 'error');
      clearUploadState();
      return;
    }

    const emptyFile = acceptedFiles.find((file) => file.size <= 0);
    if (emptyFile) {
      const message = pickLocalized(language, 'Boş dosya yüklenemez.', 'Empty files cannot be uploaded.');
      setUploadValidationError(message);
      addToast(message, 'error');
      clearUploadState();
      return;
    }

    const totalSizeBytes = acceptedFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSizeBytes > STUDIO_TOTAL_MAX_FILE_SIZE_BYTES) {
      const sizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(1);
      const message = pickLocalized(language, `Toplam dosya boyutu ${sizeMb} MB. Studio Desk limiti ${maxTotalSizeMb} MB. Dosyaları küçültüp tekrar deneyin.`, `Total file size is ${sizeMb} MB. Studio Desk limit is ${maxTotalSizeMb} MB. Please reduce the files and try again.`);
      setUploadValidationError(message);
      addToast(message, 'error', 6500);
      clearUploadState();
      return;
    }

    const file = acceptedFiles[0];
    const additionalFiles = acceptedFiles.slice(1);

    setUploadValidationError(null);
    setImage(file);
    setMimeType(file.type);
    setPreviewUrl(URL.createObjectURL(file));
    setPdfText(null);
    setAdditionalUploads([]);

    try {
      if (additionalFiles.length > 0) {
        const nextAdditionalUploads = [];

        // Additional uploads are processed sequentially to reduce main-thread spikes
        // when users drop multiple large images/PDFs in one shot.
        for (const entry of additionalFiles) {
          const dataUrl = await readFileAsDataUrl(entry);
          const base64 = dataUrl.split(',')[1] ?? '';
          nextAdditionalUploads.push({
            name: entry.name,
            mimeType: entry.type,
            base64,
            sizeBytes: entry.size,
          });
        }

        setAdditionalUploads(nextAdditionalUploads);
      }
    } catch (error) {
      console.error('Ek dosyalar okunamadi', error);
      void reportClientError({
        scope: 'upload.additional_files',
        message: 'Additional files processing failed',
        details: {
          count: additionalFiles.length,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      const message = pickLocalized(language, 'Ek dosyalar okunamadı. Lütfen tekrar deneyin.', 'Additional files could not be read. Please try again.');
      setUploadValidationError(message);
      addToast(message, 'error');
      clearUploadState();
      return;
    }

    if (additionalFiles.length > 0) {
      addToast(pickLocalized(language, `${additionalFiles.length + 1} dosya Studio Desk'e yüklendi.`, `${additionalFiles.length + 1} files were uploaded to Studio Desk.`), 'success', 3200);
    }

    if (file.type === 'application/pdf') {
      try {
        const isValidPdf = await validatePdfMagicBytes(file);
        if (!isValidPdf) {
          const message = pickLocalized(language, 'Geçersiz PDF dosyası algılandı.', 'Invalid PDF file detected.');
          addToast(message, 'error');
          setUploadValidationError(message);
          clearUploadState();
          return;
        }

        // Critical path: base64 must be available quickly so analysis can start.
        const dataUrl = await readFileAsDataUrl(file);
        const base64String = dataUrl.split(',')[1] ?? '';
        setImageBase64(base64String);

        const extractedText = await runOptionalPdfTask(
          extractPdfTextWithPdfjs(file),
          null,
          PDF_TEXT_TIMEOUT_MS,
          'metin çıkarımı'
        );
        const suspiciousFlags = await runOptionalPdfTask<PdfRiskFlag[]>(
          detectSuspiciousPdfContent(file),
          [],
          PDF_SECURITY_SCAN_TIMEOUT_MS,
          'güvenlik taraması'
        );

        if (extractedText) {
          setPdfText(extractedText);
        }

        if (suspiciousFlags.length > 0) {
          const flagLabels = suspiciousFlags.map((flag) => localizePdfRiskFlag(flag, language)).join(', ');
          addToast(
            pickLocalized(
              language,
              `PDF içinde riskli içerik göstergeleri tespit edildi (${flagLabels}). Dikkatle devam edin.`,
              `Risky content indicators were found in the PDF (${flagLabels}). Proceed with caution.`,
            ),
            'info',
            8000
          );
        }
      } catch (error) {
        console.error('PDF işleme hatası', error);
        void reportClientError({
          scope: 'upload.pdf_processing',
          message: 'PDF processing failed',
          details: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        setUploadValidationError(
          pickLocalized(
            language,
            'PDF işlenemedi. Lütfen daha küçük ya da farklı bir dosya deneyin.',
            'The PDF could not be processed. Please try a smaller or different file.',
          ),
        );
        addToast(
          pickLocalized(
            language,
            'PDF işlenemedi. Lütfen farklı bir dosya deneyin.',
            'The PDF could not be processed. Please try a different file.',
          ),
          'error',
        );
        clearUploadState();
      }
    } else {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const base64String = dataUrl.split(',')[1] ?? '';
        setImageBase64(base64String);
      } catch (error) {
        console.error('Gorsel isleme hatasi', error);
        void reportClientError({
          scope: 'upload.image_processing',
          message: 'Image processing failed',
          details: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        const message = pickLocalized(
          language,
          'Görsel işlenemedi. Lütfen dosyayı tekrar deneyin.',
          'The image could not be processed. Please try the file again.',
        );
        setUploadValidationError(message);
        addToast(message, 'error');
        clearUploadState();
      }
    }
  }, [
    addToast,
    language,
    maxTotalSizeMb,
    setImage,
    setImageBase64,
    setAdditionalUploads,
    setMimeType,
    setPreviewUrl,
    setPdfText,
    setUploadValidationError,
  ]);

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    if (fileRejections.length === 0) return;
    const message = describeRejectedFiles(fileRejections, language, maxTotalSizeMb);
    setUploadValidationError(message);
    addToast(message, 'error', 6500);
    setImage(null);
    setImageBase64(null);
    setAdditionalUploads([]);
    setMimeType(null);
    setPreviewUrl(null);
    setPdfText(null);
  }, [
    addToast,
    language,
    maxTotalSizeMb,
    setImage,
    setImageBase64,
    setAdditionalUploads,
    setMimeType,
    setPreviewUrl,
    setPdfText,
    setUploadValidationError,
  ]);

  const dropzone = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: STUDIO_MAX_FILES,
    multiple: true,
  } as Parameters<typeof useDropzone>[0]);

  return dropzone;
}
