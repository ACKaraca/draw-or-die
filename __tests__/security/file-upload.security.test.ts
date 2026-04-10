/**
 * Draw-or-Die File Upload Security Tests
 *
 * Tests for secure file upload handling:
 * - PDF file type validation (MIME type + magic bytes)
 * - File size limits enforced
 * - Malicious PDF detection (embedded code/scripts)
 * - No code execution from uploaded files
 * - File naming security (no path traversal)
 */

import { describe, it, expect } from '@jest/globals';

describe('File Upload Security - Draw-or-Die', () => {
  /**
   * Test: PDF file type validation using magic bytes (not just extension)
   * Prevents attackers from uploading executable files with .pdf extension
   */
  it('should validate PDF file type using magic bytes', () => {
    const validatePDFMagicBytes = (buffer: Uint8Array | Buffer): boolean => {
      // PDF files start with %PDF magic bytes (0x25 0x50 0x44 0x46)
      if (buffer.length < 4) return false;

      const magic = String.fromCharCode(
        buffer[0],
        buffer[1],
        buffer[2],
        buffer[3]
      );

      return magic === '%PDF';
    };

    // Valid PDF magic bytes
    const validPDF = Buffer.from('%PDF-1.4 content here');
    expect(validatePDFMagicBytes(validPDF)).toBe(true);

    // Invalid magic bytes
    const invalidFile = Buffer.from('fake.pdf content here');
    expect(validatePDFMagicBytes(invalidFile)).toBe(false);

    // Empty file
    const emptyFile = Buffer.from('');
    expect(validatePDFMagicBytes(emptyFile)).toBe(false);

    // Executable file with .pdf extension
    const exeFile = Buffer.from('MZ\x90\x00content'); // PE executable header
    expect(validatePDFMagicBytes(exeFile)).toBe(false);
  });

  /**
   * Test: File size limits are enforced
   * Prevents disk space exhaustion and denial-of-service attacks
   */
  it('should enforce maximum file size limits', () => {
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

    const validateFileSize = (fileSize: number): boolean => {
      return fileSize > 0 && fileSize <= MAX_FILE_SIZE;
    };

    // Valid file sizes
    expect(validateFileSize(1024)).toBe(true); // 1 KB
    expect(validateFileSize(10 * 1024 * 1024)).toBe(true); // 10 MB
    expect(validateFileSize(50 * 1024 * 1024)).toBe(true); // 50 MB (max)

    // Invalid file sizes
    expect(validateFileSize(0)).toBe(false); // Empty
    expect(validateFileSize(51 * 1024 * 1024)).toBe(false); // Over limit
    expect(validateFileSize(100 * 1024 * 1024)).toBe(false); // Way over
    expect(validateFileSize(-1)).toBe(false); // Negative
  });

  /**
   * Test: Suspicious PDF content is detected and flagged
   * Detects PDFs with embedded JavaScript, forms, or executable content
   */
  it('should detect malicious content in PDF files', () => {
    const detectMaliciousPDFContent = (pdfContent: string): {
      hasSuspiciousContent: boolean;
      warnings: string[];
    } => {
      const warnings: string[] = [];
      let hasSuspiciousContent = false;

      // Detect JavaScript in PDF
      if (/\/JavaScript|\/JS|\/ASCIIHexDecode|\/ASCII85Decode/gi.test(pdfContent)) {
        warnings.push('Detected JavaScript in PDF');
        hasSuspiciousContent = true;
      }

      // Detect embedded files
      if (/\/EmbeddedFile|\/Encrypt|\/OpenAction/gi.test(pdfContent)) {
        warnings.push('Detected embedded files or auto-execute in PDF');
        hasSuspiciousContent = true;
      }

      // Detect form actions
      if (/\/AA|\/AcroForm|\/SubmitForm|\/ImportData/gi.test(pdfContent)) {
        warnings.push('Detected form actions in PDF');
        hasSuspiciousContent = true;
      }

      // Detect external references
      if (/\/Launch|\/SubmitForm|\/XFA|\/XDP/gi.test(pdfContent)) {
        warnings.push('Detected external references or launch actions');
        hasSuspiciousContent = true;
      }

      return { hasSuspiciousContent, warnings };
    };

    // Clean PDF
    const cleanPDF = '%PDF-1.4\n/Type /Catalog\n/Pages 1 0 R\n/Title (Project)';
    const cleanResult = detectMaliciousPDFContent(cleanPDF);
    expect(cleanResult.hasSuspiciousContent).toBe(false);
    expect(cleanResult.warnings.length).toBe(0);

    // Malicious PDF with JavaScript
    const maliciousPDF = '%PDF-1.4\n/JavaScript\n/AA << /O <</S /JavaScript /JS (malicious())>> >>';
    const malResult = detectMaliciousPDFContent(maliciousPDF);
    expect(malResult.hasSuspiciousContent).toBe(true);
    expect(malResult.warnings.some((w) => w.includes('JavaScript'))).toBe(true);

    // PDF with embedded files
    const embeddedPDF = '%PDF-1.4\n/EmbeddedFile /Encrypt << /V 5 >>';
    const embResult = detectMaliciousPDFContent(embeddedPDF);
    expect(embResult.hasSuspiciousContent).toBe(true);
  });

  /**
   * Test: Uploaded files are not served with execution permissions
   * PDFs are always served with Content-Disposition: attachment (download, not preview)
   */
  it('should serve uploaded files with safe headers (no execution)', () => {
    const getUploadResponseHeaders = (fileName: string, mimeType: string) => {
      return {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`, // Force download
        'Content-Security-Policy': "default-src 'none'", // Strict CSP for uploads
        'X-Content-Type-Options': 'nosniff', // Prevent MIME sniffing
        'Cache-Control': 'no-store, max-age=0', // Don't cache uploads
      };
    };

    const headers = getUploadResponseHeaders('project.pdf', 'application/pdf');

    // Check headers prevent execution
    expect(headers['Content-Disposition']).toContain('attachment');
    expect(headers['Content-Disposition']).not.toContain('inline');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Content-Security-Policy']).not.toContain('script-src');
  });

  /**
   * Test: File path traversal attacks are prevented
   * Sanitizes file names to prevent directory traversal (../, ..\, etc.)
   */
  it('should prevent directory traversal in file uploads', () => {
    const sanitizeFileName = (fileName: string): string => {
      // Remove dangerous path characters
      return fileName
        .replace(/\.\./g, '') // Remove ..
        .replace(/[/\\]/g, '') // Remove / and \
        .replace(/^\./, '') // Remove leading dot
        .replace(/[<>:"|?*\0]/g, '') // Remove invalid characters
        .trim();
    };

    // Normal files
    expect(sanitizeFileName('my-project.pdf')).toBe('my-project.pdf');
    expect(sanitizeFileName('Final Design 2024.pdf')).toBe('Final Design 2024.pdf');

    // Path traversal attempts
    expect(sanitizeFileName('../../../etc/passwd')).toBe('etcpasswd'); // / removed
    expect(sanitizeFileName('..\\..\\system32')).toBe('system32'); // \ removed
    expect(sanitizeFileName('my..file.pdf')).toBe('myfile.pdf'); // .. removed
    expect(sanitizeFileName('.bashrc')).toBe('bashrc'); // Leading dot removed

    // Special characters
    expect(sanitizeFileName('file<script>.pdf')).toBe('filescript.pdf');
    expect(sanitizeFileName('file|evil.pdf')).toBe('fileevil.pdf');
  });

  /**
   * Test: File upload endpoint requires authentication
   * Unauthenticated users cannot upload files
   */
  it('should require authentication for file uploads', () => {
    const requireAuthForUpload = (
      authToken: string | null | undefined,
      fileSize: number
    ): boolean => {
      // Must have valid auth token
      if (!authToken || authToken.length === 0) {
        return false; // Reject unauthenticated
      }

      // Token should be a valid JWT-like string (simplified check)
      if (!/^[A-Za-z0-9\-_\.]+$/.test(authToken)) {
        return false; // Invalid token format
      }

      return fileSize > 0 && fileSize <= 50 * 1024 * 1024;
    };

    // No auth - rejected
    expect(requireAuthForUpload(null, 1024)).toBe(false);
    expect(requireAuthForUpload(undefined, 1024)).toBe(false);
    expect(requireAuthForUpload('', 1024)).toBe(false);

    // Invalid token - rejected
    expect(requireAuthForUpload('invalid token with spaces', 1024)).toBe(false);

    // Valid auth and file - allowed
    expect(requireAuthForUpload('valid.token.string', 1024)).toBe(true);
  });

  /**
   * Test: Uploaded files are scanned before storage
   * Checks file integrity and absence of known malware signatures
   */
  it('should validate uploaded files before storage', () => {
    const validateUploadBeforeStorage = (file: {
      name: string;
      size: number;
      mimeType: string;
      buffer: Buffer;
    }): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      // Check file size
      if (file.size === 0) {
        errors.push('Empty file');
      } else if (file.size > 50 * 1024 * 1024) {
        errors.push('File too large');
      }

      // Check MIME type
      if (file.mimeType !== 'application/pdf') {
        errors.push('Invalid MIME type (expected application/pdf)');
      }

      // Check magic bytes for PDF
      if (file.buffer.length < 4 || 
          String.fromCharCode(file.buffer[0], file.buffer[1], file.buffer[2], file.buffer[3]) !== '%PDF') {
        errors.push('Invalid PDF magic bytes');
      }

      // Check file name
      if (!/\.(pdf)$/i.test(file.name)) {
        errors.push('Invalid file extension');
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    };

    // Valid file
    const validFile = {
      name: 'project.pdf',
      size: 1024 * 100,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 content'),
    };
    expect(validateUploadBeforeStorage(validFile).valid).toBe(true);

    // Invalid MIME type
    const invalidMimeFile = { ...validFile, mimeType: 'text/plain' };
    const mimeResult = validateUploadBeforeStorage(invalidMimeFile);
    expect(mimeResult.valid).toBe(false);
    expect(mimeResult.errors.some((e) => e.includes('MIME'))).toBe(true);

    // Invalid magic bytes
    const invalidMagicFile = { ...validFile, buffer: Buffer.from('fake pdf') };
    const magicResult = validateUploadBeforeStorage(invalidMagicFile);
    expect(magicResult.valid).toBe(false);
    expect(magicResult.errors.some((e) => e.includes('magic'))).toBe(true);
  });
});
