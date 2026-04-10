#!/usr/bin/env bash
# pre-commit hook: block accidental secret commits
# Install: cp scripts/pre-commit-check-secrets.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

RED='\033[0;31m'
NC='\033[0m'

BLOCKED_PATTERNS=(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ"
  "SUPABASE_SERVICE_ROLE_KEY=eyJ"
  "STRIPE_SECRET_KEY=sk_live_"
  "STRIPE_WEBHOOK_SECRET=whsec_"
  "sk_test_[A-Za-z0-9]"
  "AIzaSy"
  "-----BEGIN PRIVATE KEY-----"
  "-----BEGIN RSA PRIVATE KEY-----"
)

FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$FILES" ]; then
  exit 0
fi

FOUND=0
for pattern in "${BLOCKED_PATTERNS[@]}"; do
  MATCHES=$(git diff --cached | grep -E "^\+" | grep -E "$pattern" || true)
  if [ -n "$MATCHES" ]; then
    echo -e "${RED}[BLOCKED] Potential secret detected (pattern: $pattern):${NC}"
    echo "$MATCHES"
    FOUND=1
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo -e "${RED}Commit blocked: remove secrets and use environment variables instead.${NC}"
  echo "See .env.example for safe placeholder format."
  exit 1
fi

exit 0
