#!/usr/bin/env python3
"""
Script to remove debug logging statements from frontend React/TypeScript code.
Removes console.log statements with debug emoji and other debug patterns.
"""

import re
import os
from pathlib import Path

def remove_debug_logs(file_path):
    """Remove debug logging from a TypeScript/JavaScript file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    lines = content.split('\n')
    cleaned_lines = []

    # Emoji patterns to remove
    debug_emojis = ['🔊', '🔍', '📡', '🔐', '✅', '📥', '📨', '🚀', '🔌', '⏸️', '⚠️', '❌']

    for line in lines:
        # Check if line contains console.log with debug emoji
        is_debug_log = False
        for emoji in debug_emojis:
            if f'console.log(' in line and emoji in line:
                is_debug_log = True
                break

        # Keep the line if it's not a debug log
        if not is_debug_log:
            cleaned_lines.append(line)

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
        for file in project_dir.rglob(f'src/**/{ext}'):
            if remove_debug_logs(file):
                modified_files.append(file)
                print(f"✅ Cleaned: {file.relative_to(project_dir)}")

    print(f"\n📊 Summary: Removed debug logs from {len(modified_files)} files")

    if modified_files:
        print("\nModified files:")
        for f in modified_files:
            print(f"  - {f.relative_to(project_dir)}")

if __name__ == "__main__":
    main()
