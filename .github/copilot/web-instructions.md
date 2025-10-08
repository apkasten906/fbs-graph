---
applyTo: 'apps/web/**'
---

# Web App Guidelines

## Purpose

The `@rb9k/web` package is the frontend Next.js application for Resume Builder 9000, providing:

- User interface for uploading resumes and job descriptions
- Resume tailoring workflow
- Preview and download of generated resumes

## Next.js Patterns

1. **App Router**
   - Use the App Router directory structure
   - Group related routes logically
   - Use loading.tsx and error.tsx for better UX

2. **Server vs. Client Components**
   - Prefer Server Components for static/initial rendering
   - Use Client Components only when interactivity is needed
   - Create clear boundaries between server and client code

```typescript
// ✅ Good pattern for form handling
// Form.tsx (Client Component)
"use client";
export function Form({ onSubmit }) {
  // Client-side state and handlers
}

// page.tsx (Server Component)
import { Form } from "./Form";
export default async function Page() {
  // Server-side data fetching
  return <Form onSubmit={createServerAction} />;
}
```

3. **Data Fetching**
   - Use server-side data fetching in Server Components
   - Implement optimistic updates for better UX
   - Handle loading and error states gracefully

## UI Components

- Use Tailwind CSS for styling
- Adopt shadcn/ui components for consistent design
- Extend the design system as needed in components/ui/
- Ensure components are accessible and responsive

## Form Handling

- Use React Hook Form for complex forms
- Implement proper validation (client and server)
- Provide helpful error messages
- Show loading states during submissions

## State Management

- Use React Context for shared state when necessary
- Keep state close to where it's used
- Consider using React Query for server state

## Testing

- Use Jest and React Testing Library
- Focus on user interactions rather than implementation
- Test key user flows and edge cases
