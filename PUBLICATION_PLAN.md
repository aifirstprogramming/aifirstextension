# VS Code Extension Publication Plan

This document outlines the steps required to publish the AI First Programming extension to the VS Code Marketplace, including automated publishing via GitHub Actions.

## Overview

The publication process involves:
1. **Manual Setup Steps** (one-time): Publisher registration and token creation
2. **Code Updates**: Configuration files and package.json updates
3. **Automation Setup**: GitHub Actions workflow for automated publishing
4. **Security**: Proper handling of secrets and tokens

## Manual Steps (One-Time Setup)

These steps must be completed manually and cannot be automated:

### 1. Create Azure DevOps Organization

- Visit [Azure DevOps](https://dev.azure.com/)
- Sign in with a Microsoft account (use the account that will own the publisher)
- Create a new organization if you don't have one
- **Note**: The organization name doesn't need to match the publisher name

### 2. Create Personal Access Token (PAT)

1. From your Azure DevOps organization home page, click your profile icon
2. Select **User settings** → **Personal access tokens**
3. Click **New Token**
4. Configure the token:
   - **Name**: "VS Code Extension Publishing" (or similar)
   - **Organization**: Select **All accessible organizations** (IMPORTANT: Not a specific org)
   - **Expiration**: Set to 1 year or more (recommended: 2 years)
   - **Scopes**: 
     - Select **Custom defined**
     - Click **Show all scopes**
     - Under **Marketplace**, select **Manage** scope
5. Click **Create**
6. **IMPORTANT**: Copy the token immediately - it won't be shown again
7. Store the token securely (you'll add it to GitHub Secrets)

### 3. Create Publisher

1. Navigate to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
2. Log in with the same Microsoft account used for Azure DevOps
3. Click **Create publisher** in the left pane
4. Fill in the required fields:
   - **ID**: `aifirstprogramming` (or your chosen unique identifier - cannot be changed later)
   - **Note**: The publisher ID is separate from your GitHub organization name. You can use the same name for consistency, but they don't have to match.
   - **Name**: "AI First Book" (or your display name)
   - **Description**: Optional description
   - **Support URL**: Optional support link
5. Click **Create**
6. **Note**: The publisher ID will be used in `package.json`

### 4. Add GitHub Secrets

1. Go to your GitHub repository: https://github.com/aifirstprogramming/aifirstextension
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:
   - **Name**: `VSCE_PAT`
   - **Value**: Paste your Personal Access Token from step 2
   - Click **Add secret**

## Code Updates Required

### 1. Update package.json

The following fields need to be added/updated in `package.json`:

```json
{
  "publisher": "aifirstprogramming",
  "repository": {
    "type": "git",
    "url": "https://github.com/aifirstprogramming/aifirstextension.git"
  },
  "bugs": {
    "url": "https://github.com/aifirstprogramming/aifirstextension/issues"
  },
  "homepage": "https://github.com/aifirstprogramming/aifirstextension#readme",
  "keywords": [
    "ai",
    "programming",
    "education",
    "learning",
    "copilot",
    "examples",
    "book",
    "tutorial"
  ],
  "description": "A companion extension for the AI First Programming book series that provides easy access to book examples, prompts, and code responses. Includes a Language Model Chat Provider that returns exact code examples from the books."
}
```

**Important Notes:**
- `publisher` must match the publisher ID created in step 3
- `keywords` must not exceed 30 items (Marketplace limit)
- `description` should be clear and concise (appears in Marketplace)

### 2. Verify .vscodeignore

The existing `.vscodeignore` file looks good, but verify it excludes:
- Source TypeScript files (`**/*.ts`)
- TypeScript config files (`**/tsconfig.json`)
- ESLint config (`**/eslint.config.mjs`)
- Source maps (`**/*.map`)
- Development files

### 3. Create CHANGELOG.md

Create a `CHANGELOG.md` file following the [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Change Log

All notable changes to the "AI First Programming" extension will be documented in this file.

## [0.0.1] - YYYY-MM-DD

### Added
- Initial release of AI First Programming extension
- Book content browser with hierarchical navigation
- Example viewer with syntax highlighting
- Copy functionality for prompts and responses
- AI First Book Examples Language Model Chat Provider
- Language-aware prompt matching
- Getting started walkthrough
```

## GitHub Actions Workflow

### Create Workflow File

Create `.github/workflows/publish.yml` for automated publishing:

```yaml
name: Publish VS Code Extension

on:
  push:
    tags:
      - 'v*.*.*'  # Triggers on version tags like v0.0.1, v1.2.3, etc.
  workflow_dispatch:  # Allows manual triggering
    inputs:
      version:
        description: 'Version to publish (patch, minor, major, or specific version)'
        required: true
        default: 'patch'
        type: choice
        options:
          - patch
          - minor
          - major

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch all history for version detection

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install vsce
        run: npm install -g @vscode/vsce

      - name: Determine version
        id: version
        run: |
          if [ "${{ github.event_name }}" == "workflow_dispatch" ]; then
            VERSION_TYPE="${{ github.event.inputs.version }}"
            if [ "$VERSION_TYPE" == "patch" ] || [ "$VERSION_TYPE" == "minor" ] || [ "$VERSION_TYPE" == "major" ]; then
              CURRENT_VERSION=$(node -p "require('./package.json').version")
              NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version)
              echo "version=$NEW_VERSION" >> $GITHUB_OUTPUT
              echo "version_type=$VERSION_TYPE" >> $GITHUB_OUTPUT
            else
              echo "version=$VERSION_TYPE" >> $GITHUB_OUTPUT
              echo "version_type=custom" >> $GITHUB_OUTPUT
            fi
          else
            # Extract version from tag (e.g., v0.0.1 -> 0.0.1)
            VERSION=${GITHUB_REF#refs/tags/v}
            echo "version=$VERSION" >> $GITHUB_OUTPUT
            echo "version_type=tag" >> $GITHUB_OUTPUT
          fi

      - name: Update package.json version
        if: steps.version.outputs.version_type != 'tag'
        run: |
          npm version ${{ steps.version.outputs.version }} --no-git-tag-version
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add package.json
          git commit -m "Bump version to ${{ steps.version.outputs.version }}" || exit 0
          git push

      - name: Compile TypeScript
        run: npm run compile

      - name: Package extension
        run: vsce package

      - name: Publish to Marketplace
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
        run: |
          if [ "${{ steps.version.outputs.version_type }}" == "tag" ]; then
            vsce publish -p $VSCE_PAT
          else
            vsce publish ${{ steps.version.outputs.version }} -p $VSCE_PAT
          fi

      - name: Upload VSIX artifact
        uses: actions/upload-artifact@v4
        with:
          name: extension-vsix
          path: '*.vsix'
          retention-days: 30
```

## Publishing Workflow Options

### Option 1: Tag-Based Publishing (Recommended)

1. Make your changes and commit to `main` branch
2. Create a git tag with the version:
   ```bash
   git tag v0.0.1
   git push origin v0.0.1
   ```
3. GitHub Actions will automatically:
   - Detect the tag
   - Extract the version
   - Compile and package the extension
   - Publish to Marketplace

### Option 2: Manual Workflow Dispatch

1. Go to **Actions** tab in GitHub
2. Select **Publish VS Code Extension** workflow
3. Click **Run workflow**
4. Choose version type: `patch`, `minor`, or `major`
5. Click **Run workflow**
6. The workflow will:
   - Bump the version in package.json
   - Commit the version change
   - Compile and package
   - Publish to Marketplace

## Security Considerations

### ✅ DO:
- Store Personal Access Token in GitHub Secrets (never in code)
- Use `VSCE_PAT` secret in GitHub Actions
- Limit PAT scope to only **Marketplace (Manage)**
- Set PAT expiration (recommended: 1-2 years)
- Review dependencies regularly for vulnerabilities
- Use `.vscodeignore` to exclude sensitive files
- Use `.gitignore` to prevent committing tokens

### ❌ DON'T:
- Commit Personal Access Tokens to the repository
- Share PATs in public channels
- Use overly broad scopes for PATs
- Include source files in published extension
- Include development dependencies in published package

## Pre-Publication Checklist

Before publishing, ensure:

- [ ] `package.json` has correct `publisher` field
- [ ] `package.json` has `repository` field with correct URL
- [ ] `package.json` has meaningful `description`
- [ ] `package.json` has `keywords` (max 30)
- [ ] `LICENSE` file exists and is correct
- [ ] `README.md` is complete and user-friendly
- [ ] `CHANGELOG.md` exists with initial version
- [ ] `.vscodeignore` excludes source files
- [ ] Extension compiles without errors (`npm run compile`)
- [ ] Extension packages successfully (`vsce package`)
- [ ] VSIX file can be installed locally for testing
- [ ] GitHub Secret `VSCE_PAT` is configured
- [ ] Publisher is created in Marketplace
- [ ] GitHub Actions workflow file is created

## Testing Before Publishing

1. **Local Testing**:
   ```bash
   npm run compile
   vsce package
   code --install-extension ai-first-programming-0.0.1.vsix
   ```

2. **Verify Installation**:
   - Extension appears in Extensions view
   - Sidebar icon is visible
   - Commands work correctly
   - Language model provider is registered

3. **Test Package Contents**:
   - Extract `.vsix` file (it's a ZIP)
   - Verify no source files are included
   - Verify only necessary files are present

## Post-Publication Steps

1. **Verify on Marketplace**:
   - Visit [VS Code Marketplace](https://marketplace.visualstudio.com/)
   - Search for "AI First Programming"
   - Verify extension details are correct
   - Check that README displays properly

2. **Update README**:
   - Update Marketplace link in README.md once published
   - Replace placeholder with actual Marketplace URL

3. **Test Installation from Marketplace**:
   - Install extension from Marketplace in a clean VS Code instance
   - Verify all features work correctly

## Version Management

### Semantic Versioning

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

### Version Bumping

The GitHub Actions workflow supports:
- Automatic version bumping via workflow dispatch
- Tag-based versioning (recommended for releases)

## Troubleshooting

### Common Issues

1. **403 Forbidden Error**:
   - Verify PAT has **Marketplace (Manage)** scope
   - Verify PAT organization is set to **All accessible organizations**
   - Check PAT hasn't expired

2. **401 Unauthorized Error**:
   - Verify `VSCE_PAT` secret is correctly set in GitHub
   - Verify publisher ID matches in `package.json`

3. **Extension Name Already Exists**:
   - Extension name must be unique in Marketplace
   - Consider adding publisher prefix or changing name

4. **Too Many Keywords**:
   - Limit keywords to 30 or fewer
   - Remove less important keywords

## References

- [VS Code Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Tool](https://github.com/microsoft/vscode-vsce)
- [Visual Studio Marketplace](https://marketplace.visualstudio.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Next Steps

1. Complete manual setup steps (Publisher, PAT, GitHub Secrets)
2. Update `package.json` with required fields
3. Create `CHANGELOG.md`
4. Create GitHub Actions workflow file
5. Test packaging locally
6. Create first release tag and publish

