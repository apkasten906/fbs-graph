---
description: 'Dev server restart and process management instructions for Copilot and developers.'
applyTo: '**/dev.ps1'
---

# Dev Server Restart and Process Management Instructions

- Always ensure that any existing API or web dev server processes are terminated before starting new ones.
- The `dev.ps1` script is responsible for killing any stale `npm run dev` processes for both API and web servers before launching new instances.
- This prevents port conflicts, stale code, and ensures the latest build is always running.
- Copilot and developers should always use the `dev.ps1` script to start or restart the development environment after making changes that require a rebuild (backend, shared, or frontend code).
- If you encounter issues with servers not updating or port conflicts, manually check for and kill any lingering `node` or `npm run dev` processes, then rerun the script.
- Never run multiple dev servers for the same service on the same port.
