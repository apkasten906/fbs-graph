## Mandatory TypeScript Return Types

## All functions (including arrow and async functions) must have explicit return types. Never rely on type inference for exported or public functions. This is mandatory for all TypeScript code.

## applyTo: 'packages/core/\*\*'

# Core Package Guidelines

## PowerShell Scripting Rules

- Only use PowerShell for dev environment scripting and Copilot chat automation.
- NEVER use special characters (icons) when creating PowerShell scripts. Use plain text only for messages and output.

## Purpose

The `@rb9k/core` package contains the central business logic for Resume Builder 9000. It handles:

- Parsing and processing of resumes and job descriptions
- Scoring and relevance calculations
- Deterministic text transformation and generation
- Type definitions used across the project

## Key Principles

1. **Deterministic First**: All core functionality must work without AI. Implement deterministic solutions before considering AI enhancements.

2. **Type Safety**: Use strict typing for all functions and data structures. Avoid `any` types.

3. **Pure Functions**: Prefer pure functions that don't rely on external state when possible.

4. **Clear Module Boundaries**: Each module should have a clear responsibility:
   - `parsing/`: Extract structured data from unstructured inputs
   - `scoring/`: Calculate relevance between achievements and job requirements
   - `synth/`: Generate or transform text content
   - `taxonomy/`: Handle skills categorization and matching
   - `intelligence/`: Analyze job descriptions and extract requirements

## Feature Flag Usage

```typescript
// Import flags at the top of the file
import { flags } from '../flags';

// Use conditionals to determine behavior
export function analyzeText(text: string): AnalysisResult {
  if (flags.allowExternalLLM) {
    // Enhanced version with AI
    return enhancedAnalysis(text);
  }

  // Default deterministic version
  return deterministicAnalysis(text);
}
```

## Testing

- Each core function should have unit tests
- Tests should cover both deterministic and AI-powered paths
- Use snapshots for expected text transformations
