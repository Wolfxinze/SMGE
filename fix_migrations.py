#!/usr/bin/env python3
"""
Automated migration fixer - makes all migrations idempotent
Adds IF NOT EXISTS, DROP IF EXISTS patterns to all CREATE statements
"""

import re
import sys
from pathlib import Path

def fix_create_index(content):
    """Add IF NOT EXISTS to CREATE INDEX statements"""
    pattern = r'CREATE INDEX (?!IF NOT EXISTS)(\w+)'
    replacement = r'CREATE INDEX IF NOT EXISTS \1'
    return re.sub(pattern, replacement, content)

def fix_create_policy(content):
    """Add DROP POLICY IF EXISTS before CREATE POLICY statements"""
    # Find all CREATE POLICY statements
    lines = content.split('\n')
    fixed_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this line contains CREATE POLICY
        if re.match(r'^\s*CREATE POLICY\s+"([^"]+)"', line):
            # Extract policy name and table name
            policy_match = re.search(r'CREATE POLICY\s+"([^"]+)"', line)
            if policy_match:
                policy_name = policy_match.group(1)

                # Look ahead to find ON table_name
                table_name = None
                for j in range(i, min(i + 5, len(lines))):
                    table_match = re.search(r'ON\s+([\w.]+)', lines[j])
                    if table_match:
                        table_name = table_match.group(1)
                        break

                if table_name:
                    # Check if DROP already exists in previous lines
                    has_drop = False
                    if i > 0:
                        prev_line = lines[i-1]
                        if f'DROP POLICY IF EXISTS "{policy_name}"' in prev_line:
                            has_drop = True

                    if not has_drop:
                        # Add DROP POLICY IF EXISTS before CREATE POLICY
                        drop_line = f'DROP POLICY IF EXISTS "{policy_name}" ON {table_name};'
                        fixed_lines.append(drop_line)

        fixed_lines.append(line)
        i += 1

    return '\n'.join(fixed_lines)

def fix_create_trigger(content):
    """Add DROP TRIGGER IF EXISTS before CREATE TRIGGER statements"""
    lines = content.split('\n')
    fixed_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if this line contains CREATE TRIGGER
        if re.match(r'^\s*CREATE TRIGGER\s+(\w+)', line):
            trigger_match = re.search(r'CREATE TRIGGER\s+(\w+)', line)
            if trigger_match:
                trigger_name = trigger_match.group(1)

                # Look ahead to find ON table_name
                table_name = None
                for j in range(i, min(i + 5, len(lines))):
                    table_match = re.search(r'ON\s+([\w.]+)', lines[j])
                    if table_match:
                        table_name = table_match.group(1)
                        break

                if table_name:
                    # Check if DROP already exists in previous lines
                    has_drop = False
                    if i > 0:
                        prev_line = lines[i-1]
                        if f'DROP TRIGGER IF EXISTS {trigger_name}' in prev_line:
                            has_drop = True

                    if not has_drop:
                        # Add DROP TRIGGER IF EXISTS before CREATE TRIGGER
                        drop_line = f'DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};'
                        fixed_lines.append(drop_line)

        fixed_lines.append(line)
        i += 1

    return '\n'.join(fixed_lines)

def fix_migration_file(filepath):
    """Fix a single migration file"""
    print(f"Fixing {filepath.name}...")

    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content

    # Apply fixes in order
    content = fix_create_index(content)
    content = fix_create_policy(content)
    content = fix_create_trigger(content)

    # Only write if changes were made
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  ✓ Fixed {filepath.name}")
        return True
    else:
        print(f"  - No changes needed for {filepath.name}")
        return False

def main():
    migrations_dir = Path('supabase/migrations')

    # Migrations to fix (excluding 00001, 00002, 00005 which are already fixed)
    migrations_to_fix = [
        '00003_brand_brain_schema.sql',
        '00004_rate_limiting.sql',
        '00006_post_generator_schema.sql',
        '00007_engagement_agent.sql',
        '00008_engagement_agent_schema.sql',
        '00009_payment_subscription_schema.sql',
        '00010_social_scheduler_schema.sql',
        '00011_free_tier_initialization.sql',
    ]

    fixed_count = 0

    for migration_name in migrations_to_fix:
        filepath = migrations_dir / migration_name
        if filepath.exists():
            if fix_migration_file(filepath):
                fixed_count += 1
        else:
            print(f"  ✗ File not found: {migration_name}")

    print(f"\n✓ Fixed {fixed_count} migration files")
    print("All migrations are now idempotent and safe to re-run!")

if __name__ == '__main__':
    main()
