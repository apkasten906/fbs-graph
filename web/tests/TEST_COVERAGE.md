# UI Component Test Suite

This test suite verifies that UI components are appearing correctly across all pages in the FBS Graph application.

## Test Coverage

### 1. Page Structure Tests (`web/page-structure.test.ts`)

**42 Tests** - Validates HTML structure and integration patterns

#### Simple Pages (with content-wrapper)

- Home (`index.html`)
- Playoff Preview (`playoff-preview.html`)
- Rankings (`rankings.html`)

**Tests verify:**

- Shared navigation CSS is included
- Content-wrapper div is present
- Navigation module is imported and initialized correctly
- Proper HTML5 structure (DOCTYPE, html, head, body)
- Common theme CSS is included

#### Visualizer Pages (without content-wrapper)

- Matchup Timeline (`matchup-timeline.html`)
- CFB Graph Timeline Explorer (`cfb-graph-timeline-explorer.html`)
- CFB Graph Visualizer (`cfb-graph-visualizer.html`)

**Tests verify:**

- Shared navigation CSS is included
- NO content-wrapper div (uses body margin pattern instead)
- Body margin-left styles for navigation offset (220px)
- Body.nav-collapsed margin reset styles
- Navigation module integration
- Main element is direct child of body

#### Cross-Page Tests

- All pages use same navigation initialization pattern
- All pages include shared navigation CSS
- All pages include common theme CSS
- CSS variables are used consistently

### 2. CSS Structure Tests (`web/css-structure.test.ts`)

**30 Tests** - Validates CSS files and styling patterns

#### shared-nav.css (15 tests)

- File exists and is populated
- Defines required selectors: `.nav-container`, `.nav-menu`, `.nav-toggle`, `.nav-toggle-fixed`
- Uses dark theme CSS variables (--panel, --ink, --muted, --accent)
- Navigation width is 220px
- Transition duration is 0.3s
- Content-wrapper styles are defined
- Nav-collapsed state styles exist
- Fixed positioning is used
- Z-index layering is defined
- Hover and active link styles
- Smooth transition animations

#### common-theme.css (7 tests)

- Defines all required CSS variables
- Uses dark color scheme
- Variables include: --bg, --panel, --ink, --muted, --accent

#### Page-specific CSS

- Conditional tests for visualizer-specific CSS files

#### CSS Consistency (4 tests)

- Colors are not hardcoded (use CSS variables)
- Collapsed state transform defined
- Content-wrapper margin adjusts with nav state
- Navigation icon styling

### 3. Layout Behavior Tests (`web/layout-behavior.test.ts`)

**70 Tests** - Validates layout patterns and component positioning

#### Content Wrapper Pattern (6 tests)

- Simple pages have content-wrapper div
- Simple pages don't have body margin override

#### Body Margin Pattern (12 tests)

- Visualizer pages DON'T have content-wrapper
- Visualizer pages have body margin-left override (220px)
- Visualizer pages have body.nav-collapsed reset (margin: 0)
- Transition on body for smooth nav toggle

#### Navigation Module Integration (18 tests)

- All pages import shared-nav module
- All pages call initNavigation with correct identifier
- All pages use ES6 module script type

#### CSS Link Order (6 tests)

- common-theme.css loads before shared-nav.css on all pages

#### DOM Structure (2 tests)

- Visualizer pages have main as direct body child
- Simple pages have content nested in content-wrapper

#### Navigation Constants (2 tests)

- 220px navigation width used consistently
- 0.3s transition duration used consistently

#### Accessibility (18 tests)

- All pages have proper DOCTYPE
- All pages have html, head, body elements
- All pages have title elements

#### Script Loading (6 tests)

- Navigation module loads after DOM content
- Scripts positioned near end of body tag

### 4. Shared Navigation Component Tests (`web/modules/shared-nav.test.ts`)

**8 Tests** - Validates navigation module code structure

**Tests verify:**

- Exports initNavigation function
- Creates nav-container, nav-menu, nav-toggle elements
- Includes all menu items (Home, Playoff Preview, Rankings, Timeline Explorer, Matchup Timeline)
- Uses localStorage for state persistence
- Toggles nav-collapsed class
- Supports both content-wrapper and body class toggling
- Highlights active page
- Creates both inline and fixed toggle buttons

## Test Execution

Run all UI tests:

```bash
npm run test:run -- web/
```

Run specific test file:

```bash
npm run test:run -- web/page-structure.test.ts
```

Run tests with coverage:

```bash
npm run test:coverage -- web/
```

## Test Results Summary

✅ **159 tests passing**

- 42 tests: Page Structure
- 30 tests: CSS Structure
- 70 tests: Layout Behavior
- 8 tests: Shared Navigation Component
- 9 tests: Static Data Adapter (existing)

## Key Patterns Validated

### Two Layout Patterns Supported

1. **Simple Pages Pattern**
   - Uses `<div class="content-wrapper">` wrapper
   - Content-wrapper has margin-left: 220px
   - Toggles `.nav-collapsed` class on wrapper
   - Pages: index.html, playoff-preview.html, rankings.html

2. **Visualizer Pages Pattern**
   - No content-wrapper div
   - Body has inline margin-left: 220px style
   - Toggles `.nav-collapsed` class on body element
   - Main element is direct child of body (required for flex layouts)
   - Pages: matchup-timeline.html, cfb-graph-timeline-explorer.html, cfb-graph-visualizer.html

### Navigation Constants

- Width: **220px**
- Transition: **0.3s ease**
- Z-index: **1000** (nav), **1001** (fixed toggle)

### CSS Variables

- `--bg`: Background color (#0b1020)
- `--panel`: Panel/card background (#121a33)
- `--ink`: Primary text color (#e9eefc)
- `--muted`: Secondary text color (#9fb0e8)
- `--accent`: Accent/highlight color (#7ae)

## Coverage Areas

✅ **Structural Integrity**

- All pages have required HTML5 elements
- Navigation is integrated consistently
- CSS files are linked in correct order

✅ **Layout Patterns**

- Simple pages use content-wrapper correctly
- Visualizer pages use body margin pattern correctly
- Main elements positioned correctly for page type

✅ **Navigation Functionality**

- Module exports correct function
- Creates expected DOM elements
- Includes all menu items
- Supports state persistence
- Handles both layout patterns

✅ **Styling Consistency**

- CSS variables used throughout
- Dark theme colors applied
- Navigation width and transitions standardized
- Active page highlighting implemented

✅ **Accessibility**

- Semantic HTML structure
- Proper document structure
- Title elements present

## Future Enhancements

Potential additional tests to consider:

- E2E browser tests for actual user interactions
- Visual regression tests for layout consistency
- Performance tests for navigation animations
- Accessibility audit tests (ARIA, keyboard navigation)
- Cross-browser compatibility tests
