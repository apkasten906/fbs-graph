/**
 * Shared Navigation Component
 * Creates a collapsible navigation sidebar for all pages
 */

export function initNavigation(activePage) {
  const navHTML = `
    <nav class="nav-container" id="navContainer">
      <div class="nav-menu">
        <ul>
          <li>
            <a href="index.html" class="${activePage === 'home' ? 'active' : ''}">
              Home
              <button class="nav-toggle" id="navToggle" title="Toggle navigation">☰</button>
            </a>
          </li>
          <li><a href="cfb-graph-timeline-explorer.html" class="${activePage === 'cfb-graph-timeline-explorer' ? 'active' : ''}">Timeline Explorer</a></li>
          <li><a href="matchup-timeline.html" class="${activePage === 'matchup-timeline' ? 'active' : ''}">Matchup Timeline</a></li>
          <li><a href="cfb-graph-visualizer.html" class="${activePage === 'cfb-graph' ? 'active' : ''}">CFB Graph Visualizer</a></li>
          <li><a href="playoff-preview.html" class="${activePage === 'playoff-preview' ? 'active' : ''}">Playoff Preview</a></li>
          <li><a href="rankings.html" class="${activePage === 'rankings' ? 'active' : ''}">Rankings</a></li>          
        </ul>
      </div>
    </nav>
    <button class="nav-toggle-fixed" id="navToggleFixed" title="Show navigation">☰</button>
  `;

  // Insert navigation at the beginning of body
  document.body.insertAdjacentHTML('afterbegin', navHTML);

  // Get references
  const navContainer = document.getElementById('navContainer');
  const navToggle = document.getElementById('navToggle');
  const navToggleFixed = document.getElementById('navToggleFixed');

  // Load saved state from localStorage
  const isCollapsed = localStorage.getItem('navCollapsed') === 'true';
  if (isCollapsed) {
    navContainer.classList.add('collapsed');
    document.querySelectorAll('.content-wrapper').forEach(el => {
      el.classList.add('nav-collapsed');
    });
    document.body.classList.add('nav-collapsed');
  }

  // Toggle functionality for both buttons
  const toggleNav = e => {
    e.preventDefault();
    e.stopPropagation();
    const collapsed = navContainer.classList.toggle('collapsed');
    document.querySelectorAll('.content-wrapper').forEach(el => {
      el.classList.toggle('nav-collapsed', collapsed);
    });
    document.body.classList.toggle('nav-collapsed', collapsed);
    localStorage.setItem('navCollapsed', collapsed.toString());
  };

  navToggle.addEventListener('click', toggleNav);
  navToggleFixed.addEventListener('click', toggleNav);

  return {
    navContainer,
    navToggle,
    collapse: () => {
      navContainer.classList.add('collapsed');
      document.querySelectorAll('.content-wrapper').forEach(el => {
        el.classList.add('nav-collapsed');
      });
      document.body.classList.add('nav-collapsed');
      localStorage.setItem('navCollapsed', 'true');
    },
    expand: () => {
      navContainer.classList.remove('collapsed');
      document.querySelectorAll('.content-wrapper').forEach(el => {
        el.classList.remove('nav-collapsed');
      });
      document.body.classList.remove('nav-collapsed');
      localStorage.setItem('navCollapsed', 'false');
    },
  };
}
