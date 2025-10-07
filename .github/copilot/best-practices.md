---
applyTo: '**'
---

# Development Best Practices & Learnings

## Code Quality

### 1. Consistent Code Style

- Use ESLint and Prettier across all packages
- Run linting as part of CI/CD process
- Enforce TypeScript strict mode

### 2. Pull Request Guidelines

- Keep PRs focused on single concerns
- Include tests with all feature PRs
- Document feature flag implications
- Update documentation when APIs change

### 3. Commit Messages

Follow conventional commits:

```
feat: add resume upload component
fix: correct relevance scoring algorithm
docs: update API documentation
refactor: simplify job parser logic
```

## Testing Strategy

### 1. Test Pyramid

- Unit tests for business logic (highest coverage)
- Integration tests for API endpoints
- E2E tests for critical user journeys

### 2. Test Isolation

- Mock external dependencies
- Use test fixtures over hardcoded values
- Reset state between tests

## Performance Optimization

### 1. Frontend

- Measure and optimize Core Web Vitals
- Implement code splitting and lazy loading
- Optimize images and assets
- Use proper caching strategies

### 2. Backend

- Profile API response times
- Consider batch processing for heavy operations
- Implement appropriate caching
- Optimize database queries

## Security Practices

### 1. Input Validation

- Validate all user inputs server-side
- Sanitize HTML/markdown when displaying user content
- Use parameterized queries for database operations

### 2. Output Handling

- Set appropriate Content Security Policy
- Use HTTPS for all communications
- Implement proper authentication for API endpoints

## Accessibility

### 1. WCAG Compliance

- Aim for WCAG AA compliance
- Test with keyboard navigation
- Support screen readers
- Maintain sufficient color contrast

### 2. Progressive Enhancement

- Ensure core functionality works without JavaScript
- Provide fallbacks for complex interactions
- Test across different browsers and devices

## Learning Resources

### 1. TypeScript

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### 2. React & Next.js

- [React Docs (Beta)](https://beta.reactjs.org/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Patterns](https://reactpatterns.com/)

### 3. Testing

- [Testing JavaScript](https://testingjavascript.com/)
- [Vitest Documentation](https://vitest.dev/)

### 4. Performance

- [Web.dev Performance](https://web.dev/performance-scoring/)
- [Next.js Performance](https://nextjs.org/docs/advanced-features/measuring-performance)

## Learnings & Takeaways

> _This section should be updated as the team learns and evolves the project_

- **2023-09-01**: Discovered that template-based bullet rewriting provides better consistency than rule-based approaches
- **2023-10-15**: Implemented a hybrid scoring algorithm that balances keyword matching with semantic relevance
- **2023-11-20**: Found that preprocessing PDFs with OCR improves text extraction quality significantly
