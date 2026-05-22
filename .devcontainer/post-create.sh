#!/bin/bash

set -e

echo "Running post-create setup..."

# ---------------------------------------------------------------------------
# 1. Load personal config from .devcontainer/.env (gitignored).
#    Parses KEY=value pairs, strips inline comments, exports each var for
#    this script session, and persists them to ~/.bashrc so every future
#    VS Code terminal session has CFBD_KEY, APOLLO_PORT, etc. available.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV="${SCRIPT_DIR}/.env"
BASHRC_ENV="${HOME}/.devcontainer-env"

if [ -f "${LOCAL_ENV}" ]; then
  echo "Loading personal config from ${LOCAL_ENV}..."

  # Start a clean generated env file
  echo "# Auto-generated from .devcontainer/.env — do not edit directly" > "${BASHRC_ENV}"

  while IFS='=' read -r key rawval; do
    # Skip blank lines and full-line comments
    [[ -z "$key" || "$key" == \#* ]] && continue
    # Strip inline comment (everything after the first whitespace + #)
    val="$(printf '%s' "$rawval" | sed 's/[[:space:]]*#.*//')"
    # Strip leading/trailing whitespace
    val="$(printf '%s' "$val" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    # Strip surrounding quotes (single or double)
    val="${val%\"}" ; val="${val#\"}"
    val="${val%\'}" ; val="${val#\'}"
    # Export for this script session
    export "$key"="$val"
    # Write a properly quoted export line for persistent sessions
    printf 'export %s="%s"\n' "$key" "$val" >> "${BASHRC_ENV}"
  done < "${LOCAL_ENV}"

  # Hook the generated file into ~/.bashrc (runs once; idempotent)
  MARKER="# fbs-graph devcontainer env"
  if ! grep -q "$MARKER" ~/.bashrc 2>/dev/null; then
    {
      printf '\n%s\n' "$MARKER"
      printf '[ -f "%s" ] && source "%s"\n' "${BASHRC_ENV}" "${BASHRC_ENV}"
    } >> ~/.bashrc
    echo "  Persisted env vars to ~/.bashrc via ${BASHRC_ENV}"
  fi
else
  echo "  No .devcontainer/.env found — relying on remoteEnv from devcontainer.json only"
fi

# ---------------------------------------------------------------------------
# 2. Git: mark the workspace as safe (avoids "dubious ownership" errors when
#    the workspace mount is owned by a different UID than the container user)
# ---------------------------------------------------------------------------
git config --global --add safe.directory /workspace

# ---------------------------------------------------------------------------
# 3. Git: line-ending and branch defaults
# ---------------------------------------------------------------------------
git config --global core.autocrlf input
git config --global init.defaultBranch main

# ---------------------------------------------------------------------------
# 4. Git identity — forwarded from host via remoteEnv or loaded from .env above
# ---------------------------------------------------------------------------
if [ -n "${GIT_AUTHOR_NAME}" ]; then
  git config --global user.name "${GIT_AUTHOR_NAME}"
  echo "  git user.name  = ${GIT_AUTHOR_NAME}"
else
  echo "  WARNING: GIT_AUTHOR_NAME not set — git commits will have no author name."
  echo "           Set it in your host shell profile or in .devcontainer/.env"
fi

if [ -n "${GIT_AUTHOR_EMAIL}" ]; then
  git config --global user.email "${GIT_AUTHOR_EMAIL}"
  echo "  git user.email = ${GIT_AUTHOR_EMAIL}"
else
  echo "  WARNING: GIT_AUTHOR_EMAIL not set — git commits will have no author email."
  echo "           Set it in your host shell profile or in .devcontainer/.env"
fi

# ---------------------------------------------------------------------------
# 5. Repair node_modules ownership if it was installed during the image build
#    as a different user (e.g. root) and the container runs as 'node'
# ---------------------------------------------------------------------------
if [ -d "node_modules" ] && [ ! -w "node_modules" ]; then
  echo "node_modules is not writable by $(whoami); repairing ownership..."
  if command -v sudo >/dev/null 2>&1; then
    sudo chown -R "$(id -u):$(id -g)" node_modules
  else
    mv node_modules "node_modules.root-owned.$(date +%s)"
  fi
fi

# ---------------------------------------------------------------------------
# 6. Install / sync npm dependencies
# ---------------------------------------------------------------------------
echo "Installing dependencies..."
npm install

echo ""
echo "Post-create setup complete!"
echo ""
echo "Next steps:"
echo "  - Ensure CFBD_KEY is set in .env (project root) or .devcontainer/.env"
echo "  - Run 'npm run dev'        to start the GraphQL server (port 4100)"
echo "  - Run 'npm run web:serve'  to start the static web server (port 4173)"
echo "  - Run 'npm test'           to run the Vitest test suite"
