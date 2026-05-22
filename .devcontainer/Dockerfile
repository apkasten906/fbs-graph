# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# fbs-graph dev container
# Node.js 20 LTS on Debian Bookworm — matches @types/node ^20.x in package.json
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/devcontainers/javascript-node:20-bookworm

# Install PowerShell (needed for scripts/setup.ps1 and scripts/*.ps1)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        wget \
        apt-transport-https \
        software-properties-common \
    && wget -q "https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb" \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends powershell \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the workspace directory
WORKDIR /workspace

# Copy package files first to leverage Docker layer caching for npm install
COPY --chown=node:node package.json package-lock.json* ./

# Install dependencies as root so global tools are available to all users,
# then fix ownership so the non-root 'node' user can use the workspace
RUN npm ci --ignore-scripts \
    && chown -R node:node /workspace

# Copy the rest of the project
COPY --chown=node:node . .

# Switch to non-root user for all subsequent operations
USER node

# Expose the GraphQL server and static web server ports
EXPOSE 4100 4173
