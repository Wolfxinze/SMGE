#!/bin/bash
# Validate all migrations are idempotent

cd "$(dirname "$0")"

for file in supabase/migrations/0000{3..11}*.sql; do
  if [ ! -f "$file" ]; then
    continue
  fi

  filename=$(basename "$file")
  echo "=== $filename ==="

  # Count CREATE INDEX with IF NOT EXISTS
  total_idx=$(grep -c "CREATE INDEX" "$file" 2>/dev/null || echo "0")
  safe_idx=$(grep "CREATE INDEX IF NOT EXISTS" "$file" | wc -l | tr -d ' ')
  echo "  Indexes: $safe_idx/$total_idx use IF NOT EXISTS"

  # Count CREATE POLICY with DROP before it
  total_pol=$(grep -c "CREATE POLICY" "$file" 2>/dev/null || echo "0")
  safe_pol=$(grep -B1 "CREATE POLICY" "$file" | grep -c "DROP POLICY IF EXISTS" 2>/dev/null || echo "0")
  echo "  Policies: $safe_pol/$total_pol have DROP before CREATE"

  # Count CREATE TRIGGER with DROP before it
  total_trg=$(grep -c "CREATE TRIGGER" "$file" 2>/dev/null || echo "0")
  safe_trg=$(grep -B1 "CREATE TRIGGER" "$file" | grep -c "DROP TRIGGER IF EXISTS" 2>/dev/null || echo "0")
  echo "  Triggers: $safe_trg/$total_trg have DROP before CREATE"

  # Check if idempotent
  if [ "$total_idx" -eq "$safe_idx" ] && [ "$total_pol" -eq "$safe_pol" ] && [ "$total_trg" -eq "$safe_trg" ]; then
    echo "  ✓ IDEMPOTENT"
  else
    echo "  ⚠ NOT FULLY IDEMPOTENT"
  fi
  echo ""
done
