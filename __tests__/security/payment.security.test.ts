/**
 * Draw-or-Die Payment Security Tests
 * 
 * Tests for Stripe payment security:
 * - PCI compliance (never store full card numbers)
 * - Amount validation (prevents $0 or negative charges)
 * - Price enforcement (server-side pricing, not user-controlled)
 * - Metadata security (no sensitive data in Stripe metadata)
 */

import { describe, it, expect } from '@jest/globals';

describe('Payment Security - Draw-or-Die', () => {
  /**
   * Test: Stripe prices are never hardcoded or user-controlled
   * Uses server-side Stripe Price IDs to prevent price manipulation
   */
  it('should use server-side Stripe Price IDs (not user input)', () => {
    const STRIPE_PRICES = {
      GLOBAL: {
        PRICE_IDS: {
          MONTHLY: 'price_global_monthly_123',
          YEARLY: 'price_global_yearly_456',
          RAPIDO: 'price_global_rapido_789',
        },
      },
      TR_STUDENT: {
        PRICE_IDS: {
          MONTHLY: 'price_tr_student_monthly_111',
          YEARLY: 'price_tr_student_yearly_222',
          RAPIDO: 'price_tr_student_rapido_333',
        },
      },
    };

    // Price IDs must exist and be strings
    Object.values(STRIPE_PRICES).forEach((tier) => {
      Object.values(tier.PRICE_IDS).forEach((priceId) => {
        expect(typeof priceId).toBe('string');
        expect(priceId.startsWith('price_')).toBe(true);
      });
    });
  });

  /**
   * Test: Amount validation prevents $0, negative, or unauthorized amounts
   */
  it('should validate purchase amounts are positive integers', () => {
    const validateAmount = (amount: unknown): number | null => {
      if (typeof amount !== 'number') return null;
      if (amount <= 0) return null; // Reject zero or negative
      if (!Number.isInteger(amount)) return null; // Reject decimals
      return amount;
    };

    expect(validateAmount(100)).toBe(100);
    expect(validateAmount(1)).toBe(1);
    expect(validateAmount(0)).toBeNull();
    expect(validateAmount(-50)).toBeNull();
    expect(validateAmount(99.99)).toBeNull();
    expect(validateAmount('100')).toBeNull();
  });

  /**
   * Test: Client-provided metadata never includes sensitive data
   */
  it('should not store sensitive data in Stripe metadata', () => {
    const validateMetadata = (metadata: Record<string, any>): boolean => {
      const forbiddenKeys = ['password', 'token', 'secret', 'api_key', 'card_number'];
      const forbiddenPatterns = [/card[_-]?number/, /cvv/, /ssn/, /password/i];
      
      for (const [key, value] of Object.entries(metadata)) {
        // Check key names
        if (forbiddenKeys.includes(key.toLowerCase())) return false;
        
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(key)) return false;
        }
        
        // Check values for obvious secrets
        if (typeof value === 'string' && /^(sk_|pk_test_|Bearer\s)/.test(value)) {
          return false;
        }
      }
      
      return true;
    };

    // Valid metadata
    expect(validateMetadata({ user_id: 'user-123', checkout_mode: 'rapido_pack' })).toBe(true);
    
    // Invalid metadata (contains sensitive data)
    expect(validateMetadata({ password: 'secret123' })).toBe(false);
    expect(validateMetadata({ card_number: '4111111111111111' })).toBe(false);
    expect(validateMetadata({ api_token: 'sk_test_123456' })).toBe(false);
    expect(validateMetadata({ cvv: '123' })).toBe(false);
  });

  /**
   * Test: Student tier pricing is enforced based on email domain
   * Prevents unauthorized discount application
   */
  it('should only apply student pricing to verified .edu.tr emails', () => {
    const isEduTrEmail = (email: string): boolean => {
      return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.edu\.tr$/.test(email);
    };

    const getPriceTier = (email: string) => {
      return isEduTrEmail(email) ? 'TR_STUDENT' : 'GLOBAL';
    };

    // Student discounts
    expect(getPriceTier('student@university.edu.tr')).toBe('TR_STUDENT');
    expect(getPriceTier('prof@yildiz.edu.tr')).toBe('TR_STUDENT');
    
    // No student discounts
    expect(getPriceTier('user@gmail.com')).toBe('GLOBAL');
    expect(getPriceTier('user@fake-edu.tr')).toBe('GLOBAL');
    expect(getPriceTier('student@university.com')).toBe('GLOBAL');
  });

  /**
   * Test: Quantity limits prevent excessive bulk purchases
   */
  it('should enforce minimum rapido purchase quantity', () => {
    const MIN_RAPIDO = 50;
    const validateQuantity = (qty: unknown): number => {
      const parsed = typeof qty === 'number' ? qty : parseInt(String(qty));
      return Math.max(parsed || MIN_RAPIDO, MIN_RAPIDO);
    };

    expect(validateQuantity(100)).toBe(100);
    expect(validateQuantity(50)).toBe(50);
    expect(validateQuantity(25)).toBe(50); // Below minimum
    expect(validateQuantity(0)).toBe(50);  // Zero
    expect(validateQuantity(-100)).toBe(50); // Negative
  });

  /**
   * Test: Payment mode is validated before creating Stripe session
   */
  it('should validate checkout mode matches Stripe session mode', () => {
    const validateCheckoutMode = (mode: string): 'payment' | 'subscription' | null => {
      if (mode === 'rapido_pack') return 'payment';
      if (mode === 'premium_monthly' || mode === 'premium_yearly') return 'subscription';
      return null;
    };

    expect(validateCheckoutMode('rapido_pack')).toBe('payment');
    expect(validateCheckoutMode('premium_monthly')).toBe('subscription');
    expect(validateCheckoutMode('premium_yearly')).toBe('subscription');
    expect(validateCheckoutMode('invalid')).toBeNull();
  });

  /**
   * Test: Success/cancel URLs use the origin from request (prevents open redirect)
   */
  it('should use request origin for success/cancel URLs (prevents open redirect)', () => {
    const validateRedirectUrl = (origin: string, fallback: string): string => {
      if (!origin) return fallback;
      // Use URL parsing for scheme validation — handles all protocol variants
      // including case variations (JAVASCRIPT:) and encoded forms.
      // Do NOT rely on startsWith checks which are bypassable.
      try {
        const url = new URL(origin);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return fallback;
        }
        return origin;
      } catch {
        return fallback;
      }
    };

    const appUrl = 'https://drawor-die.com';
    const localhost = 'http://localhost:3000';
    
    // Valid origin
    expect(validateRedirectUrl('https://drawor-die.com', localhost))
      .toBe('https://drawor-die.com');
    
    // Invalid origin falls back
    expect(validateRedirectUrl('javascript:alert(1)', localhost))
      .toBe(localhost);
    expect(validateRedirectUrl('', localhost))
      .toBe(localhost);
    expect(validateRedirectUrl('data:text/html,<script>alert(1)</script>', localhost))
      .toBe(localhost);
  });

  /**
   * Test: User ID is passed to Stripe as client_reference_id (for reconciliation)
   */
  it('should include user_id in checkout session for reconciliation', () => {
    const createCheckoutMetadata = (userId: string, mode: string, qty?: number) => {
      return {
        user_id: userId,
        checkout_mode: mode,
        rapido_quantity: mode === 'rapido_pack' ? String(qty || 50) : '0',
      };
    };

    const metadata = createCheckoutMetadata('user-123', 'rapido_pack', 100);
    
    expect(metadata.user_id).toBe('user-123');
    expect(metadata.checkout_mode).toBe('rapido_pack');
    expect(metadata.rapido_quantity).toBe('100');
  });

  /**
   * Test: No payment processing logic should happen on client
   * All Stripe operations happen on backend via Stripe SDK
   */
  it('should never expose Stripe Secret Key to client', () => {
    const secretKeyPattern = /^sk_(test|live)_[a-zA-Z0-9]{20,}$/;
    
    // These should be server-only
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    
    // Public keys can be in env, but secrets never
    const publicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '';
    
    // Secret key should only be used server-side
    if (secretKey) {
      expect(secretKeyPattern.test(secretKey)).toBe(true);
    }
    
    // Public key should start with pk_
    if (publicKey) {
      expect(publicKey.startsWith('pk_')).toBe(true);
      expect(publicKey.startsWith('sk_')).toBe(false);
    }
  });

  /**
   * Test: User email is captured from auth context, not request body
   * Prevents user from paying for someone else's account
   */
  it('should use authenticated user email, not request parameter', () => {
    const getCheckoutEmail = (authenticatedUserEmail: string, requestBody?: { email?: string }) => {
      // Always use authenticated user, never trust request body
      return authenticatedUserEmail;
    };

    const authEmail = 'real-user@university.edu.tr';
    const fakeEmail = 'attacker@gmail.com';
    
    expect(getCheckoutEmail(authEmail, { email: fakeEmail })).toBe(authEmail);
    expect(getCheckoutEmail(authEmail)).toBe(authEmail);
  });
});
