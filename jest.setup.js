// Jest setup for Draw-or-Die
require('@testing-library/jest-dom');

// Add fetch polyfill for Node.js tests
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY = 'pk_test_123';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      data: [],
      error: null,
    })),
  })),
}));

// Mock Google Generative AI
jest.mock('@google/genai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: jest.fn(),
    })),
  })),
}));

// Mock Stripe (optional - may not be installed)
try {
  jest.mock('@stripe/react-stripe-js', () => ({
    loadStripe: jest.fn(() => Promise.resolve({})),
    Elements: ({ children }) => children,
    CardElement: () => null,
  }));
} catch (_error) {
  // Stripe not installed, skip mock
}

// Suppress console warnings in tests
global.console.warn = jest.fn();
global.console.error = jest.fn();

afterEach(() => {
  jest.clearAllMocks();
});

// Add custom matchers
expect.extend({
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;
    const pass = jwtRegex.test(received);
    
    return {
      pass,
      message: () => `expected ${received} to be a valid JWT`,
    };
  },
});
