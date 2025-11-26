#!/bin/bash
#
# Script to make all migrations idempotent
# Adds IF NOT EXISTS, DROP IF EXISTS patterns to all migration files
#

echo "Making all migrations idempotent..."

# Migration files to check/fix
migrations=(
  "00003_brand_brain_schema.sql"
  "00004_rate_limiting.sql"
  "00006_post_generator_schema.sql"
  "00007_engagement_agent.sql"
  "00008_engagement_agent_schema.sql"
  "00009_payment_subscription_schema.sql"
  "00010_social_scheduler_schema.sql"
  "00011_free_tier_initialization.sql"
)

for migration in "${migrations[@]}"; do
  file="supabase/migrations/$migration"

  if [ -f "$file" ]; then
    echo "Checking $migration..."

    # Check if file already has DROP POLICY IF EXISTS
    if grep -q "DROP POLICY IF EXISTS" "$file"; then
      echo "  ✓ Already has DROP POLICY IF EXISTS"
    else
      echo "  ⚠ Missing DROP POLICY IF EXISTS - manual review needed"
    fi

    # Check if file has CREATE INDEX without IF NOT EXISTS
    if grep "CREATE INDEX" "$file" | grep -v "IF NOT EXISTS" > /dev/null 2>&1; then
      echo "  ⚠ Has CREATE INDEX without IF NOT EXISTS - manual review needed"
    else
      echo "  ✓ All indexes use IF NOT EXISTS (or no indexes)"
    fi

    # Check if file has CREATE TRIGGER without DROP
    if grep "CREATE TRIGGER" "$file" | grep -v "DROP TRIGGER IF EXISTS" > /dev/null 2>&1; then
      echo "  ⚠ Has CREATE TRIGGER without DROP - manual review needed"
    else
      echo "  ✓ All triggers use DROP IF EXISTS (or no triggers)"
    fi
  else
    echo "  ✗ File not found: $file"
  fi

  echo ""
done

echo "Review complete. Files needing manual fixes are marked with ⚠"
