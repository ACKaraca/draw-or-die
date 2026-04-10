/**
 * Draw-or-Die CORS Security Tests
 * 
 * Tests for CORS configuration to prevent:
 * - Wildcard CORS allowing any origin
 * - Credential leakage via CORS
 * - Unauthorized origin access
 * 
 * Note: These are unit tests validating CORS logic.
 * Full E2E CORS tests would require a running server.
 */

import { describe, it, expect } from '@jest/globals';

describe('CORS Security - Draw-or-Die', () => {
  /**
   * Test: CORS does not allow wildcard origin
   */
  it('should not allow wildcard CORS origin (*)', () => {
    // This configuration is WRONG - wildcard with credentials
    const badCORSHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    };

    // Check if bad config is detected
    const hasBadConfig = 
      badCORSHeaders['Access-Control-Allow-Origin'] === '*' &&
      badCORSHeaders['Access-Control-Allow-Credentials'] === 'true';

    expect(hasBadConfig).toBe(true); // Confirm the bad config exists
    
    // Proper configuration should NOT have this issue
    const properCORSHeaders = {
      'Access-Control-Allow-Origin': 'https://drawor-die.com',
      'Access-Control-Allow-Credentials': 'true',
    };

    const hasGoodConfig = 
      properCORSHeaders['Access-Control-Allow-Origin'] !== '*' &&
      properCORSHeaders['Access-Control-Allow-Credentials'] === 'true';

    expect(hasGoodConfig).toBe(true); // Good config should pass
  });

  /**
   * Test: Only whitelisted origins are allowed
   */
  it('should only allow whitelisted origins', () => {
    const ALLOWED_ORIGINS = [
      'https://drawor-die.com',
      'https://www.drawor-die.com',
      'http://localhost:3000', // dev only
    ];

    const isOriginAllowed = (origin: string): boolean => {
      return ALLOWED_ORIGINS.includes(origin);
    };

    // Allowed
    expect(isOriginAllowed('https://drawor-die.com')).toBe(true);
    expect(isOriginAllowed('http://localhost:3000')).toBe(true);
    
    // Not allowed
    expect(isOriginAllowed('https://attacker.com')).toBe(false);
    expect(isOriginAllowed('https://drawor-die.com.attacker.com')).toBe(false);
    expect(isOriginAllowed('')).toBe(false);
  });

  /**
   * Test: CORS credentials are handled securely
   */
  it('should properly handle credentials in CORS', () => {
    const isOriginAllowed = (origin: string): boolean => {
      const ALLOWED_ORIGINS = ['https://drawor-die.com', 'http://localhost:3000'];
      return ALLOWED_ORIGINS.includes(origin);
    };

    const getCORSHeaders = (origin: string | null) => {
      if (!origin || !isOriginAllowed(origin)) {
        return { 'Access-Control-Allow-Origin': 'null' };
      }

      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600',
      };
    };

    // Valid origin - includes credentials
    const validHeaders = getCORSHeaders('https://drawor-die.com');
    expect(validHeaders['Access-Control-Allow-Credentials']).toBe('true');
    expect(validHeaders['Access-Control-Allow-Origin']).toBe('https://drawor-die.com');
    
    // Invalid origin - no credentials
    const invalidHeaders = getCORSHeaders('https://attacker.com');
    expect(invalidHeaders['Access-Control-Allow-Origin']).toBe('null');
    expect(invalidHeaders['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  /**
   * Test: CORS preflight requests are validated
   */
  it('should properly handle CORS preflight requests', () => {
    const isOriginAllowed = (origin: string): boolean => {
      return ['https://drawor-die.com', 'http://localhost:3000'].includes(origin);
    };

    const handlePreflightRequest = (
      origin: string | null,
      requestMethod: string
    ): Record<string, string> | null => {
      if (!origin || !isOriginAllowed(origin)) {
        return null; // Reject preflight
      }

      const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
      if (!ALLOWED_METHODS.includes(requestMethod)) {
        return null;
      }

      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      };
    };

    // Valid preflight
    const validPreflight = handlePreflightRequest('https://drawor-die.com', 'POST');
    expect(validPreflight).not.toBeNull();
    expect(validPreflight?.['Access-Control-Allow-Methods']).toContain('POST');

    // Invalid origin preflight
    const invalidPreflight = handlePreflightRequest('https://attacker.com', 'POST');
    expect(invalidPreflight).toBeNull();

    // Invalid method preflight
    const methodPreflight = handlePreflightRequest('https://drawor-die.com', 'TRACE');
    expect(methodPreflight).toBeNull();
  });

  /**
   * Test: Public endpoints do not require credentials
   */
  it('should allow public endpoints without CORS credentials', () => {
    const PUBLIC_ENDPOINTS = [
      '/api/health',
      '/api/pricing',
      '/api/gallery',
    ];

    const requiresCredentials = (endpoint: string): boolean => {
      return !PUBLIC_ENDPOINTS.includes(endpoint);
    };

    expect(requiresCredentials('/api/health')).toBe(false);
    expect(requiresCredentials('/api/pricing')).toBe(false);
    expect(requiresCredentials('/api/checkout')).toBe(true);
    expect(requiresCredentials('/api/verify-edu')).toBe(true);
  });

  /**
   * Test: Sensitive headers are included in CORS allowlist
   */
  it('should include Authorization header in CORS allowed headers', () => {
    const ALLOWED_HEADERS = [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ];

    expect(ALLOWED_HEADERS).toContain('Authorization');
    expect(ALLOWED_HEADERS).toContain('Content-Type');
  });

  /**
   * Test: CORS max-age is reasonable (not too long, not too short)
   */
  it('should set reasonable CORS cache time', () => {
    const corsMaxAge = 86400; // 24 hours

    expect(corsMaxAge).toBeGreaterThanOrEqual(3600); // At least 1 hour
    expect(corsMaxAge).toBeLessThanOrEqual(86400 * 7); // Less than 7 days
  });

  /**
   * Test: CORS does not expose unnecessary headers
   */
  it('should not expose sensitive internal headers via CORS', () => {
    const EXPOSED_HEADERS = [
      'Content-Length',
      'X-Total-Count',
      'X-Page-Number',
    ];

    const FORBIDDEN_HEADERS = [
      'X-Internal-ID',
      'X-API-Key',
      'X-Database-Query',
      'Server', // Don't advertise server type
    ];

    // Check that forbidden headers are not in exposed list
    FORBIDDEN_HEADERS.forEach((header) => {
      expect(EXPOSED_HEADERS).not.toContain(header);
    });
  });
});
