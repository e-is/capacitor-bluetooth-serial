#!/bin/bash
# Release the plugin: build, publish to npm, git flow (master + develop + tag), and GitHub release.
#
# One branch per Capacitor major version (= the plugin major version):
#  - the most recent major is released from 'develop' (then merged into 'master')
#  - older majors are released from their maintenance branch 'v<major>.x' (e.g. 'v6.x'), when it exists
# Fixes go into the oldest maintenance branch, then are merged forward (v6.x -> v7.x -> develop).
#
# npm dist-tags: a stable version is tagged 'cap<major>' (e.g. 'cap6'), and also 'latest' if it is the
# highest published version. A pre-release is only tagged 'alpha', 'beta' or 'rc'.
#
# Usage: scripts/release.sh <version> [<release_description>] [options]
#  - version             : x.y.z (or x.y.z-alphaN / -betaN / -rcN)
#  - release_description : a comment on the release (default: 'Release <version>')
# Options:
#  -y, --yes   : skip the confirmation prompt
#  --dry-run   : build and run 'npm publish --dry-run' only (no git change, no GitHub release)
#
# Environment (can be set in '.local/env.sh'):
#  - NPM_TOKEN    : npm auth token (optional if already logged in, with 'npm login')
#  - GITHUB_TOKEN : GitHub token, to create the GitHub release (skipped if not set)

# Get to the root project
if [[ "_" == "_${PROJECT_DIR}" ]]; then
  SCRIPT_DIR=$(dirname "$0")
  PROJECT_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
  export PROJECT_DIR
fi
cd "${PROJECT_DIR}" || exit 1

# Load local environment, if any
if [[ -f "${PROJECT_DIR}/.local/env.sh" ]]; then
  echo "Loading environment variables from: '.local/env.sh'"
  source "${PROJECT_DIR}/.local/env.sh" || exit 1
fi

GITHUB_REPO="e-is/capacitor-bluetooth-serial"
DEVELOP_BRANCH="develop"

# Read parameters
skip_confirm=0
dry_run=0
version=""
release_description=""
for arg in "$@"; do
  case "$arg" in
    -y|--yes) skip_confirm=1 ;;
    --dry-run) dry_run=1 ;;
    -*) echo "Unknown option: $arg"; exit 1 ;;
    *)
      if [[ -z "$version" ]]; then version="$arg"
      elif [[ -z "$release_description" ]]; then release_description="$arg"
      else echo "Unexpected argument: $arg"; exit 1
      fi ;;
  esac
done

if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc)[0-9]+)?$ ]]; then
  echo "Wrong version format"
  echo "Usage:"
  echo " > $0 <version> [<release_description>] [-y|--yes] [--dry-run]"
  echo "with:"
  echo " - version: x.y.z (or x.y.z-alphaN / -betaN / -rcN)"
  echo " - release_description: a comment on release"
  exit 1
fi
[[ -z "$release_description" ]] && release_description="Release $version"

package=$(node -p "require('./package.json').name") || exit 1
current=$(node -p "require('./package.json').version") || exit 1
major=${version%%.*}

# npm dist-tag: 'cap<major>' for a stable version, 'alpha', 'beta' or 'rc' for a pre-release
prerelease=false
npm_tag="cap${major}"
if [[ $version =~ -(alpha|beta|rc)[0-9]+$ ]]; then
  npm_tag="${BASH_REMATCH[1]}"
  prerelease=true
fi
npm_options="--tag $npm_tag"
[[ $dry_run -eq 1 ]] && npm_options="$npm_options --dry-run"

# Also tag 'latest', if this stable version is higher than the current 'latest'
latest=$(npm view "$package" dist-tags.latest 2>/dev/null)
set_latest=false
if [[ "$prerelease" == "false" ]]; then
  if [[ -z "$latest" || "$(printf '%s\n%s\n' "$latest" "$version" | sort -V | tail -n 1)" == "$version" ]]; then
    set_latest=true
  fi
fi

# Origin branch: the maintenance branch 'v<major>.x' if it exists, otherwise 'develop'
git fetch origin || exit 1
branch_origin="$DEVELOP_BRANCH"
if git rev-parse -q --verify "refs/remotes/origin/v${major}.x" >/dev/null; then
  branch_origin="v${major}.x"
fi

# Checks
branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" != "$branch_origin" ]]; then
  echo ">> Version $version must be released from the '$branch_origin' branch (current branch: $branch)"
  exit 1
fi
# Changing the major version on develop requires a maintenance branch for the previous major
if [[ "$branch_origin" == "$DEVELOP_BRANCH" && "${current%%.*}" != "$major" ]] \
  && ! git rev-parse -q --verify "refs/remotes/origin/v${current%%.*}.x" >/dev/null; then
  echo ">> Cannot change the major version on '$DEVELOP_BRANCH' ($current -> $version) without a maintenance branch 'v${current%%.*}.x'"
  echo ">> Create it first: git push origin $DEVELOP_BRANCH:v${current%%.*}.x"
  exit 1
fi
# ('.local/' is ignored: local settings, never committed by this script)
if [[ -n $(git status --porcelain --untracked-files=no -- . ':!.local') ]]; then
  echo ">> There are uncommitted changes. Please commit (or stash) them before the release:"
  git status --short --untracked-files=no -- . ':!.local'
  exit 1
fi
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$branch_origin")" ]]; then
  echo ">> The '$branch_origin' branch is not up to date with 'origin/$branch_origin'"
  exit 1
fi
if git rev-parse -q --verify "refs/tags/$version" >/dev/null; then
  echo ">> Git tag '$version' already exists"
  exit 1
fi
if [[ "$(npm view "$package@$version" version 2>/dev/null)" == "$version" ]]; then
  echo ">> Version $version already published on npm"
  exit 1
fi

# npm authentication
if [[ -n "$NPM_TOKEN" ]]; then
  npm set //registry.npmjs.org/:_authToken "${NPM_TOKEN}" || exit 1
fi
if ! npm whoami >/dev/null 2>&1; then
  echo ">> Not logged in to npm. Run 'npm login', or set NPM_TOKEN (e.g. in '.local/env.sh')"
  exit 1
fi
if [[ -z "$GITHUB_TOKEN" && $dry_run -eq 0 ]]; then
  echo "WARNING: GITHUB_TOKEN not set: the GitHub release will NOT be created"
fi

echo "----------------------------------"
echo "- Package:         $package"
echo "- Current version: $current"
echo "- Release version: $version"
echo "- Description:     $release_description"
echo "- Branch:          $branch_origin"
echo "- npm dist-tags:   $npm_tag$([[ "$set_latest" == "true" ]] && echo ", latest") (current latest: ${latest:-none})"
echo "----------------------------------"
if [[ $skip_confirm -eq 0 ]]; then
  read -r -p "Is this correct? [y/N] " response
  [[ ! "$response" =~ ^(yes|y|Y)$ ]] && exit 1
fi

echo "----------------------------------"
echo "- Update version..."
echo "----------------------------------"
if [[ "$version" != "$current" ]]; then
  npm version "$version" --no-git-tag-version || exit 1
fi

echo "----------------------------------"
echo "- Build..."
echo "----------------------------------"
npm ci || exit 1
npm run build || exit 1
npm test || exit 1

echo "----------------------------------"
echo "- Publish to npm..."
echo "----------------------------------"
# --ignore-scripts: the build has already been done above (skip 'prepublishOnly')
npm publish --access public --ignore-scripts $npm_options || exit 1
if [[ "$set_latest" == "true" && $dry_run -eq 0 ]]; then
  npm dist-tag add "$package@$version" latest || exit 1
fi

if [[ $dry_run -eq 1 ]]; then
  echo "----------------------------------"
  echo "- Dry run OK. Restoring files..."
  echo "----------------------------------"
  git checkout -- package.json package-lock.json README.md dist || exit 1
  git clean -fdq -- dist || exit 1
  exit 0
fi

echo "----------------------------------"
echo "- Git commit, tag and push..."
echo "----------------------------------"
# Add the release files explicitly (never 'git commit -a': '.local/env.sh' holds secrets)
git add package.json package-lock.json README.md dist || exit 1
git commit -m "Release $version" || exit 1
git tag -a "$version" -m "$release_description" || exit 1

# Merge into master (stable versions released from develop only)
if [[ "$prerelease" == "false" && "$branch_origin" == "$DEVELOP_BRANCH" ]]; then
  git checkout master || exit 1
  git pull --ff-only origin master || exit 1
  git merge --no-ff --no-edit -m "Release $version" "$version" || exit 1
  git push origin master || exit 1
  git checkout "$branch_origin" || exit 1
fi
git push origin "$branch_origin" || exit 1
git push origin "refs/tags/$version" || exit 1

if [[ -n "$GITHUB_TOKEN" ]]; then
  echo "----------------------------------"
  echo "- Create GitHub release..."
  echo "----------------------------------"
  payload=$(jq -n --arg tag "$version" --arg name "$version" --arg body "$release_description" \
    --argjson prerelease "$prerelease" --arg make_latest "$set_latest" \
    '{tag_name: $tag, name: $name, body: $body, prerelease: $prerelease, make_latest: $make_latest, generate_release_notes: true}') || exit 1
  http_code=$(curl -s -o /tmp/github-release-$$.json -w "%{http_code}" -X POST \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${GITHUB_REPO}/releases" \
    -d "$payload")
  if [[ "$http_code" != "201" ]]; then
    echo ">> Failed to create the GitHub release (HTTP $http_code):"
    jq -r '.message // .' /tmp/github-release-$$.json 2>/dev/null
    rm -f /tmp/github-release-$$.json
    echo ">> npm and git are done: create the GitHub release manually, from the tag '$version'"
    exit 1
  fi
  echo "GitHub release: $(jq -r '.html_url' /tmp/github-release-$$.json)"
  rm -f /tmp/github-release-$$.json
fi

echo "----------------------------------"
echo "- Release $version OK"
echo "----------------------------------"
