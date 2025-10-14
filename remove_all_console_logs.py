#!/usr/bin/env python3
"""
Comprehensive script to remove ALL console.log statements from frontend code.
Preserves console.error and console.warn for production error tracking.
"""

import re
import os
from pathlib import Path

def remove_console_logs(file_path):
    """Remove console.log statements from a TypeScript/JavaScript file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    lines = content.split('\n')
    cleaned_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # Check if line contains console.log (but NOT console.error or console.warn)
        if 'console.log' in line and 'console.error' not in line and 'console.warn' not in line:
            # Skip this line entirely
            i += 1
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
    """Main function to process all TypeScript/JavaScript files."""
    project_dir = Path(__file__).parent
    modified_files = []

    # Process all TypeScript and JavaScript files in src directory
    for ext in ['*.ts', '*.tsx', '*.js', '*.jsx']:
        for file in project_dir.glob(f'src/**/{ext}'):
            if remove_console_logs(file):
                modified_files.append(file)
                print(f"✅ Cleaned: {file.relative_to(project_dir)}")

    print(f"\n📊 Summary: Removed console.log from {len(modified_files)} files")

    if modified_files:
        print("\nModified files:")
        for f in modified_files:
            print(f"  - {f.relative_to(project_dir)}")
    else:
        print("\n✅ No console.log statements found - code is already clean!")

if __name__ == "__main__":
    main()
