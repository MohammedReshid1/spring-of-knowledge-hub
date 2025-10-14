#!/usr/bin/env python3
"""
Fix syntax errors caused by incomplete console.log removal.
Removes orphaned object literals left after console.log statements were deleted.
"""

import re
from pathlib import Path

def fix_orphaned_objects(file_path):
    """Fix orphaned object literals from incomplete console.log removal."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    lines = content.split('\n')
    cleaned_lines = []
    i = 0
    skip_until = -1

    while i < len(lines):
        line = lines[i]

        # Skip lines we've marked for deletion
        if i < skip_until:
            i += 1
            continue

        # Pattern 1: Orphaned object properties starting with common debug keys
        # Example: "          searched: studentName,"
        #          "          matched: `something`"
        orphaned_patterns = [
            r'^\s+searched:\s',
            r'^\s+matched:\s',
            r'^\s+Name:\s.*\brow\.',
            r'^\s+Grade:\s.*\brow\.',
            r'^\s+totalInGrade:\s',
            r'^\s+withoutClass:\s',
            r'^\s+students:\s.*\.map\(',
            r'^\s+Branch:\s.*\brow\.',
            r'^\s+RegAmount:\s',
            r'^\s+QuarterAmount:\s',
        ]

        is_orphaned = any(re.match(pattern, line) for pattern in orphaned_patterns)

        if is_orphaned:
            # This is an orphaned object property, skip this line and find the end
            # Look ahead to find the closing of this object
            j = i
            brace_count = 0
            paren_count = 0
            found_end = False

            # Count braces/parens to find the end of the object
            while j < len(lines):
                test_line = lines[j]
                brace_count += test_line.count('{') - test_line.count('}')
                paren_count += test_line.count('(') - test_line.count(')')

                # If we hit a line with just "})" or "});" we found the end
                if re.match(r'^\s*\}\);?\s*$', test_line):
                    found_end = True
                    skip_until = j + 1
                    break

                # If we hit a line that looks like code again, stop
                if j > i and not re.match(r'^\s+\w+:', test_line) and test_line.strip():
                    found_end = True
                    skip_until = j
                    break

                j += 1

            if not found_end:
                # Just skip this single line if we can't find the end
                skip_until = i + 1

            # Add a comment instead
            indent = len(line) - len(line.lstrip())
            cleaned_lines.append(' ' * indent + '// Debug data logged for development')
            i = skip_until
            continue

        # Keep the line
        cleaned_lines.append(line)
        i += 1

    content = '\n'.join(cleaned_lines)

    # Remove excessive blank lines (more than 2 consecutive)
    content = re.sub(r'\n\n\n+', '\n\n', content)

    # Only write if changes were made
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    # List of files with known syntax errors from the error messages
    error_files = [
        'src/components/students/DuplicateChecker.tsx',
        'src/components/payments/BulkPaymentImport.tsx',
        'src/components/rbac/RoleBasedRoute.tsx',
        'src/components/students/BulkStudentImport.tsx',
        'src/components/students/StudentIDCard.tsx',
        'src/components/exams/GradeResults.tsx',
    ]

    base_path = Path('/Users/ahmed/Documents/GitHub/spring-of-knowledge-hub')
    fixed_count = 0

    for file_rel in error_files:
        file_path = base_path / file_rel
        if file_path.exists():
            if fix_orphaned_objects(file_path):
                print(f"✅ Fixed: {file_rel}")
                fixed_count += 1
            else:
                print(f"⏭️  No changes needed: {file_rel}")
        else:
            print(f"❌ Not found: {file_rel}")

    print(f"\n📊 Summary: Fixed {fixed_count} files")

if __name__ == '__main__':
    main()
