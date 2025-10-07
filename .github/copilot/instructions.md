# GitHub Copilot Instructions for Resume Builder 9000

## Project Overview

Resume Builder 9000 is a resume orchestration engine that creates tailored, ATS-friendly resumes for specific job postings using deterministic rules with an optional AI-powered mode.

## Architecture

- **Monorepo Structure**: Using npm workspaces with packages in `apps/` and `packages/` directories
- **Core**: TypeScript business logic for parsing, scoring, and tailoring resumes
- **API**: Node.js/Express backend with SQLite database
- **Web**: Next.js App Router frontend with Tailwind CSS and shadcn/ui

## PowerShell Scripting Rules

- Only use PowerShell for dev environment scripting and Copilot chat automation.
- NEVER use special characters (icons) when creating PowerShell scripts. Use plain text only for messages and output.

## Feature Flags

- `ALLOW_EXTERNAL_LLM`: Controls whether to use deterministic rules only (false) or allow AI assistance (true)

## Code Style Guidelines

### TypeScript

- Use strict typing with explicit type annotations for function parameters and returns
- Prefer interfaces for object types that will be extended
- Use type for simple, union, or intersection types
- Use readonly for immutable properties
- Avoid any types when possible

```typescript
// ✅ Good
interface Achievement {
  readonly id?: string;
  raw_text: string;
  skills?: string[];
}

// ❌ Avoid
const processAchievement = (data: any) => {
  /* ... */
};
```

### React/Next.js

- Use the App Router pattern with React Server Components where appropriate
- Prefer server components unless client interactivity is needed
- Use TypeScript for component props
- Follow the component/page structure in the Next.js docs

```typescript
// ✅ Good - Server Component
export default async function JobPage({ params }: { params: { id: string } }) {
  // Server-side fetching
  const jobData = await fetchJob(params.id);

  return <JobDetails job={jobData} />;
}

// ✅ Good - Client Component (only when needed)
("use client");

import { useState } from "react";

export default function ResumeForm({ initialData }: { initialData: FormData }) {
  const [formData, setFormData] = useState(initialData);

  // Client-side interactivity
}
```

### API Design

- Follow RESTful principles with consistent naming
- Use appropriate HTTP methods and status codes
- Include validation for all inputs
- Structure route handlers with clear separation of concerns

```typescript
// ✅ Good
router.post('/resume', upload.single('resume'), validateResume, async (req, res) => {
  try {
    const result = await resumeService.parse(req.file);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Testing

- Write tests for core business logic
- Focus on behavior, not implementation details
- Use descriptive test names that explain the expected behavior
- Follow the AAA pattern: Arrange, Act, Assert

```typescript
// ✅ Good
test('relevance score prioritizes must-have skills', () => {
  // Arrange
  const achievement = {
    raw_text: 'Built CI/CD pipeline with Jenkins',
    skills: ['ci-cd', 'jenkins'],
  };
  const jobProfile = { must_haves: ['ci-cd'], nice_to_haves: ['docker'] };

  // Act
  const score = calculateRelevance(achievement, jobProfile);

  // Assert
  expect(score).toBeGreaterThan(0.7);
});
```

### State Management

- Use React Context for global state when needed
- Keep state as close to where it's used as possible
- Consider server components to avoid client-side state when possible

### Error Handling

- Use try/catch blocks for async operations
- Provide meaningful error messages
- Log errors with appropriate severity
- Return consistent error responses from API

## Feature Flag Usage

When working with features that might use AI:

```typescript
// ✅ Good
import { flags } from '@rb9k/core';

export async function rewriteBullet(bullet: string, style: Style) {
  if (flags.allowExternalLLM) {
    // AI-powered approach
    return aiRewriteService.rewrite(bullet, style);
  } else {
    // Deterministic approach using templates
    return deterministicRewriter.rewrite(bullet, style);
  }
}
```

## Performance Considerations

- Minimize client-side JavaScript
- Optimize images and assets
- Use code splitting and lazy loading
- Consider edge rendering for global performance

## Accessibility

- Use semantic HTML elements
- Include proper ARIA attributes when needed
- Ensure keyboard navigation works
- Maintain sufficient color contrast
- Test with screen readers

## Learning Resources

- [Next.js App Router Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/docs)
