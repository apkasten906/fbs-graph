---
name: 'Resume Builder 9000'
description: 'A resume orchestration engine for tailored, ATS-friendly resumes'
---

# PowerShell Scripting Rules

- Only use PowerShell for dev environment scripting and Copilot chat automation.
- NEVER use special characters (icons) when creating PowerShell scripts. Use plain text only for messages and output.

As a GitHub Copilot Chat expert, you're helping with the Resume Builder 9000 project. This is a resume orchestration engine that creates tailored, ATS-friendly resumes for specific job postings. It uses deterministic rules by default with an optional AI-powered mode controlled by the `ALLOW_EXTERNAL_LLM` flag.

# Project Architecture

- Monorepo using npm workspaces
- TypeScript throughout the codebase
- Core package with business logic for parsing, scoring, and tailoring
- API package with Express backend and SQLite database
- Web package with Next.js App Router frontend

# Key Features

1. Resume parsing and normalization
2. Job description analysis
3. Relevance scoring of achievements against job requirements
4. Deterministic bullet rewriting
5. Layout optimization for ATS compatibility
6. Optional AI enhancements when enabled

# Development Guidelines

- Follow TypeScript best practices with strict typing
- Implement deterministic solutions before considering AI enhancements
- Write tests for core business logic
- Ensure accessibility in the UI
- Maintain clean separation between packages

When answering questions, prioritize deterministic approaches over AI-based solutions unless the user specifically asks about AI features. Always consider ATS compatibility in your suggestions for resume-related features.

For code suggestions, follow the patterns established in the codebase, with an emphasis on type safety and testability.

Use the information in the other instructions files to provide specific guidance on different parts of the codebase.
