#!/bin/bash

# Manual Wiki Sync Script
# This script helps you manually sync documentation to the GitHub Wiki

set -e

echo "🔄 ControlWeave Wiki Sync Tool"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -d "controlweave/docs/wiki" ]; then
    echo "❌ Error: Must run from repository root"
    echo "   Current directory: $(pwd)"
    exit 1
fi

WIKI_DIR="ControlWeaver-Pro.wiki"
WIKI_URL="https://github.com/sherifconteh-collab/ControlWeaver-Pro.wiki.git"

# Check if wiki directory exists
if [ ! -d "$WIKI_DIR" ]; then
    echo "📥 Cloning wiki repository..."
    git clone "$WIKI_URL" "$WIKI_DIR"
    echo "✅ Wiki repository cloned"
else
    echo "📂 Wiki directory found, pulling latest..."
    cd "$WIKI_DIR"
    git pull
    cd ..
    echo "✅ Wiki repository updated"
fi

echo ""
echo "📄 Syncing documentation files..."
echo ""

# Function to copy file and report
copy_file() {
    local src="$1"
    local dest="$2"
    if [ -f "$src" ]; then
        cp "$src" "$dest"
        echo "  ✅ Copied $(basename "$src")"
        return 0
    else
        echo "  ⚠️  Not found: $(basename "$src")"
        return 1
    fi
}

# Copy root level files
copy_file "controlweave/docs/wiki/Home.md" "$WIKI_DIR/"
copy_file "controlweave/docs/wiki/User-Guide.md" "$WIKI_DIR/"
copy_file "controlweave/docs/wiki/Developer-Resources.md" "$WIKI_DIR/"
copy_file "controlweave/docs/wiki/Audit-Policy-Center.md" "$WIKI_DIR/"
copy_file "controlweave/docs/wiki/Developer-Doc-Template.md" "$WIKI_DIR/"
copy_file "controlweave/docs/wiki/Policy-Page-Template.md" "$WIKI_DIR/"
copy_file "controlweave/docs/wiki/Audit-Test-Plan-Template.md" "$WIKI_DIR/"
copy_file "controlweave/docs/wiki/_Sidebar.md" "$WIKI_DIR/"
copy_file "controlweave/docs/wiki/_Footer.md" "$WIKI_DIR/"
# Copy getting-started files
if [ -d "controlweave/docs/wiki/getting-started" ]; then
    for file in controlweave/docs/wiki/getting-started/*.md; do
        if [ -f "$file" ] && [ "$(basename "$file")" != "README.md" ]; then
            copy_file "$file" "$WIKI_DIR/"
        fi
    done
fi

# Copy security files
if [ -d "controlweave/docs/wiki/security" ]; then
    for file in controlweave/docs/wiki/security/*.md; do
        if [ -f "$file" ] && [ "$(basename "$file")" != "README.md" ]; then
            copy_file "$file" "$WIKI_DIR/"
        fi
    done
fi

# Copy operations files (if they exist)
if [ -d "controlweave/docs/wiki/operations" ]; then
    for file in controlweave/docs/wiki/operations/*.md; do
        if [ -f "$file" ] && [ "$(basename "$file")" != "README.md" ]; then
            copy_file "$file" "$WIKI_DIR/"
        fi
    done
fi

# Copy deployment files (if they exist)
if [ -d "controlweave/docs/wiki/deployment" ]; then
    for file in controlweave/docs/wiki/deployment/*.md; do
        if [ -f "$file" ] && [ "$(basename "$file")" != "README.md" ]; then
            copy_file "$file" "$WIKI_DIR/"
        fi
    done
fi

# Copy reference files (if they exist)
if [ -d "controlweave/docs/wiki/reference" ]; then
    for file in controlweave/docs/wiki/reference/*.md; do
        if [ -f "$file" ] && [ "$(basename "$file")" != "README.md" ]; then
            copy_file "$file" "$WIKI_DIR/"
        fi
    done
fi

echo ""
echo "📊 Sync Summary:"
echo "   Total files in wiki: $(find "$WIKI_DIR" -name "*.md" -type f | wc -l)"
echo ""

# Check for changes
cd "$WIKI_DIR"
if git diff --quiet && git diff --cached --quiet; then
    echo "📝 No changes to commit"
    cd ..
    exit 0
fi

echo "📝 Changes detected:"
git status --short

echo ""
read -p "💾 Commit and push changes to wiki? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add .
    
    echo "Enter commit message (or press Enter for default):"
    read -r COMMIT_MSG
    
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="docs: Update wiki documentation from main repository"
    fi
    
    git commit -m "$COMMIT_MSG"
    git push
    
    echo ""
    echo "✅ Wiki updated successfully!"
    echo "   View at: https://github.com/sherifconteh-collab/ControlWeaver-Pro/wiki"
else
    echo ""
    echo "⏸️  Changes staged but not pushed"
    echo "   To push manually:"
    echo "   cd $WIKI_DIR && git push"
fi

cd ..
