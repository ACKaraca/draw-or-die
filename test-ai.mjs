#!/usr/bin/env node
/**
 * AI Edge Function Test Script
 * Tests the complete AI pipeline: Auth → Edge Function → AI Gateway → Response
 */

import { readFileSync } from 'fs';
import { join, dirname, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://avcxiovykrgomknlldiu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2Y3hpb3Z5a3Jnb21rbmxsZGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDUxNTUsImV4cCI6MjA4ODM4MTE1NX0.exGVlcT-lDalG1IgxG9sYiC8W7GBSbCB203759L463E';
const FIXTURE_FILE_NAME = 'Gemini_Generated_Image_k50n76k50n76k50n.png';

const log = (label, ...args) => console.log(`[${label}]`, ...args);
const fail = (label, ...args) => console.error(`[FAIL:${label}]`, ...args);
const pass = (label) => console.log(`[PASS:${label}] ✓`);

// ─── Test Utilities ──────────────────────────────────────────────

async function signInAnonymously() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Signup failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { jwt: data.access_token, userId: data.user.id, refreshToken: data.refresh_token };
}

async function callEdgeFunction(jwt, body) {
  const edgeUrl = `${SUPABASE_URL}/functions/v1/ai-generate`;
  assertEdgeUrlSafe(edgeUrl);
  const res = await fetch(edgeUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, text, json, ok: res.ok };
}

// Allowed base URL for edge function calls — must match SUPABASE_URL above
const ALLOWED_EDGE_HOST = new URL(SUPABASE_URL).hostname;

function loadTestImage() {
  const imgPath = join(__dirname, FIXTURE_FILE_NAME);
  const expectedDir = `${__dirname}${sep}`;
  const resolvedPath = imgPath;
  if (!resolvedPath.startsWith(expectedDir)) {
    throw new Error('Unexpected fixture path');
  }
  if (!resolvedPath.toLowerCase().endsWith('.png')) {
    throw new Error('Fixture must be a PNG file');
  }
  // codeql[js/file-access-to-http] -- This is an intentional integration test.
  // The file is a static test fixture (PNG) converted to base64 and sent to the
  // pre-configured Supabase edge function (SUPABASE_URL is a hardcoded constant).
  // The destination is validated by assertEdgeUrlSafe() before every HTTP call.
  const buffer = readFileSync(imgPath);
  return buffer.toString('base64');
}

// Guard: ensure the edge function URL still targets the expected host
function assertEdgeUrlSafe(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== ALLOWED_EDGE_HOST) {
      throw new Error(`Unexpected edge function host: ${parsed.hostname}`);
    }
  } catch (err) {
    throw new Error(`Invalid edge function URL: ${err.message}`);
  }
}

// ─── Tests ───────────────────────────────────────────────────────

async function testSupabaseHealth() {
  log('TEST', '1. Supabase REST API Health');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: ANON_KEY },
    });
    if (res.ok) pass('supabase-health');
    else fail('supabase-health', `Status: ${res.status}`);
  } catch (e) {
    fail('supabase-health', e.message);
  }
}

async function testEdgeFunctionReachable() {
  log('TEST', '2. Edge Function OPTIONS (reachable)');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-generate`, {
      method: 'OPTIONS',
    });
    if (res.ok) pass('edge-function-reachable');
    else fail('edge-function-reachable', `Status: ${res.status}`);
  } catch (e) {
    fail('edge-function-reachable', e.message);
  }
}

async function testAnonKeyRejected() {
  log('TEST', '3. Anon key should be rejected by Edge Function');
  const { status, json } = await callEdgeFunction(ANON_KEY, { operation: 'SINGLE_JURY' });
  if (status === 401 && json?.error) {
    pass('anon-key-rejected');
    log('INFO', `Message: ${json.error}`);
  } else {
    fail('anon-key-rejected', `Expected 401, got ${status}: ${JSON.stringify(json)}`);
  }
}

async function testAnonymousSignup() {
  log('TEST', '4. Anonymous signup');
  try {
    const { jwt, userId } = await signInAnonymously();
    if (jwt && userId) {
      pass('anonymous-signup');
      log('INFO', `User ID: ${userId}`);
      log('INFO', `JWT alg: ${JSON.parse(atob(jwt.split('.')[0]))?.alg}`);
      return { jwt, userId };
    } else {
      fail('anonymous-signup', 'No JWT or userId');
      return null;
    }
  } catch (e) {
    fail('anonymous-signup', e.message);
    return null;
  }
}

async function testEdgeFunctionWithJWT(jwt) {
  log('TEST', '5. Edge Function with user JWT (no image)');
  const { status, json, text } = await callEdgeFunction(jwt, {
    operation: 'SINGLE_JURY',
    params: { topic: 'Test Binası', category: 'Vaziyet Planı', harshness: 3 },
  });
  log('INFO', `Status: ${status}`);
  log('INFO', `Response: ${text.substring(0, 500)}`);
  if (status === 200 && json?.result) {
    pass('edge-function-jwt');
    return true;
  } else {
    fail('edge-function-jwt', `Status=${status}, Body=${text.substring(0, 300)}`);
    return false;
  }
}

async function testEdgeFunctionWithImage(jwt) {
  log('TEST', '6. Edge Function with real PNG image');
  try {
    const imageBase64 = loadTestImage();
    log('INFO', `Image loaded: ${(imageBase64.length / 1024).toFixed(0)} KB base64`);

    const { status, json, text } = await callEdgeFunction(jwt, {
      operation: 'SINGLE_JURY',
      imageBase64,
      imageMimeType: 'image/png',
      params: { topic: 'Mimari Pafta Testi', category: 'Vaziyet Planı', harshness: 3 },
    });
    log('INFO', `Status: ${status}`);
    log('INFO', `Response: ${text.substring(0, 500)}`);

    if (status === 200 && json?.result) {
      pass('edge-function-image');
      try {
        const parsed = JSON.parse(json.result);
        log('INFO', `AI Score: ${parsed.score}`);
        log('INFO', `Critique preview: ${(parsed.critique || '').substring(0, 200)}`);
      } catch {
        log('INFO', 'Result is not parseable JSON (raw text)');
      }
      log('INFO', `Rapido remaining: ${json.rapido_remaining}`);
      return true;
    } else {
      fail('edge-function-image', `Status=${status}`);
      return false;
    }
  } catch (e) {
    fail('edge-function-image', e.message);
    return false;
  }
}

async function testProfileSelfHeal(jwt, userId) {
  log('TEST', '7. Profile self-heal check');
  // Check if the user has a profile after Edge Function call
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` },
    });
    const profiles = await res.json();
    if (profiles.length > 0) {
      pass('profile-self-heal');
      log('INFO', `Profile: rapido=${profiles[0].rapido_pens}, premium=${profiles[0].is_premium}`);
    } else {
      fail('profile-self-heal', 'No profile found after Edge Function call');
    }
  } catch (e) {
    fail('profile-self-heal', e.message);
  }
}

async function testDefenseOperation(jwt) {
  log('TEST', '8. Defense operation (premium-only, should fail for anon)');
  const { status, json } = await callEdgeFunction(jwt, {
    operation: 'DEFENSE',
    params: {
      critique: 'Test eleştirisi',
      userMessage: 'Savunma mesajı',
      chatHistory: '[]',
      turnCount: 1,
    },
  });
  if (status === 403 && json?.code === 'PREMIUM_REQUIRED') {
    pass('defense-premium-check');
  } else {
    fail('defense-premium-check', `Expected 403 PREMIUM_REQUIRED, got ${status}: ${JSON.stringify(json)}`);
  }
}

async function testInsufficientRapido(jwt) {
  log('TEST', '9. Insufficient Rapido check (after spending)');
  // Call multiple times to exhaust rapido
  for (let i = 0; i < 20; i++) {
    const { status } = await callEdgeFunction(jwt, {
      operation: 'SINGLE_JURY',
      params: { topic: 'Rapido drain test', harshness: 1 },
    });
    if (status === 402) {
      pass('insufficient-rapido-check');
      log('INFO', `Rapido exhausted after ${i + 1} calls`);
      return;
    }
    if (status !== 200) {
      log('INFO', `Call ${i + 1}: status=${status} (may be AI error, continuing)`);
    }
  }
  fail('insufficient-rapido-check', 'Rapido never ran out after 20 calls');
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Draw or Die — AI Edge Function Test Suite     ');
  console.log('═══════════════════════════════════════════════\n');

  await testSupabaseHealth();
  await testEdgeFunctionReachable();
  await testAnonKeyRejected();

  const auth = await testAnonymousSignup();
  if (!auth) {
    console.error('\n❌ Cannot continue without authentication');
    process.exit(1);
  }

  const jwtSuccess = await testEdgeFunctionWithJWT(auth.jwt);
  
  if (jwtSuccess) {
    await testEdgeFunctionWithImage(auth.jwt);
    await testProfileSelfHeal(auth.jwt, auth.userId);
    await testDefenseOperation(auth.jwt);
    // Skip rapido drain test to save resources
    // await testInsufficientRapido(auth.jwt);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Test suite complete');
  console.log('═══════════════════════════════════════════════');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
