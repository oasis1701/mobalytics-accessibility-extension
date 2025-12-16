/**
 * D4 Paragon Board Accessibility Extension
 * Main content script - orchestrates parsing and table generation
 * Supports both Mobalytics.gg and Maxroll.gg
 */

(function() {
  'use strict';

  const D4Accessibility = {
    // Track if we've already processed the page
    processed: false,

    // Store original board containers for potential restore
    originalBoards: [],

    // Detect which site we're on
    site: null,

    /**
     * Detect which site we're on
     * @returns {string} 'mobalytics', 'maxroll', or 'unknown'
     */
    detectSite() {
      const hostname = window.location.hostname;
      if (hostname.includes('mobalytics.gg')) {
        return 'mobalytics';
      } else if (hostname.includes('maxroll.gg')) {
        return 'maxroll';
      }
      return 'unknown';
    },

    /**
     * Get the appropriate parser for the current site
     * @returns {Object} Parser object
     */
    getParser() {
      if (this.site === 'maxroll') {
        return MaxrollParser;
      }
      return ParagonParser;
    },

    /**
     * Get the board container selector for the current site
     * @returns {string} CSS selector
     */
    getBoardContainerSelector() {
      if (this.site === 'maxroll') {
        return MaxrollParser.SELECTORS.embedContainer;
      }
      return ParagonParser.SELECTORS.boardContainer;
    },

    /**
     * Initialize the extension
     */
    init() {
      this.site = this.detectSite();
      console.log(`[D4 Paragon Accessibility] Initializing on ${this.site}...`);

      if (this.site === 'unknown') {
        console.log('[D4 Paragon Accessibility] Unknown site, extension will not run');
        return;
      }

      // Wait for page to be fully loaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.onReady());
      } else {
        this.onReady();
      }
    },

    /**
     * Called when DOM is ready
     */
    onReady() {
      // Both sites use React and load content dynamically
      // We need to wait for the paragon boards to appear
      this.waitForBoards();
    },

    /**
     * Wait for paragon board elements to appear in DOM
     */
    waitForBoards() {
      const maxAttempts = 30; // 30 seconds max
      let attempts = 0;
      const selector = this.getBoardContainerSelector();

      const checkForBoards = () => {
        attempts++;

        const boards = document.querySelectorAll(selector);

        if (boards.length > 0) {
          console.log(`[D4 Paragon Accessibility] Found ${boards.length} board container(s) on ${this.site}`);
          // Give React a moment to finish rendering
          setTimeout(() => this.processBoards(), 500);
        } else if (attempts < maxAttempts) {
          // Check again in 1 second
          setTimeout(checkForBoards, 1000);
        } else {
          console.log('[D4 Paragon Accessibility] No paragon boards found on this page');
        }
      };

      checkForBoards();

      // Also observe for dynamically added boards (e.g., tab switching)
      this.observeForNewBoards();
    },

    /**
     * Set up mutation observer for dynamically added boards
     */
    observeForNewBoards() {
      const selector = this.getBoardContainerSelector();

      const observer = new MutationObserver((mutations) => {
        // Check if any new board containers were added
        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0) {
            const hasNewBoard = Array.from(mutation.addedNodes).some(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                return node.matches?.(selector) ||
                       node.querySelector?.(selector);
              }
              return false;
            });

            if (hasNewBoard && !this.processing) {
              console.log('[D4 Paragon Accessibility] New board detected, reprocessing...');
              setTimeout(() => this.processBoards(), 500);
              break;
            }
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    },

    /**
     * Process all paragon boards on the page
     */
    processBoards() {
      if (this.processing) return;

      // Skip if already processed - prevents duplicate boards
      if (document.querySelectorAll('.d4a-accessible-board').length > 0) {
        console.log('[D4 Paragon Accessibility] Boards already converted, skipping');
        return;
      }

      this.processing = true;

      try {
        console.log(`[D4 Paragon Accessibility] Processing boards on ${this.site}...`);

        // Get the appropriate parser for this site
        const parser = this.getParser();

        // Parse all boards
        const boards = parser.parseAllBoards();

        // Calculate gate connections now that we have all boards
        parser.calculateGateConnections(boards);

        if (boards.length === 0) {
          console.log('[D4 Paragon Accessibility] No boards with nodes found');
          this.processing = false;
          return;
        }

        console.log(`[D4 Paragon Accessibility] Parsed ${boards.length} board(s)`);

        // Generate accessible tables
        boards.forEach(board => {
          this.makeAccessible(board);
        });

        // Add navigation landmarks
        this.addNavigationLandmarks(boards);

        // Announce to screen reader that accessible version is available
        this.announceToScreenReader(`${boards.length} paragon board${boards.length > 1 ? 's' : ''} converted to accessible tables`);

        this.processed = true;
        console.log('[D4 Paragon Accessibility] Processing complete');
      } catch (error) {
        console.error('[D4 Paragon Accessibility] Error processing boards:', error);
      } finally {
        this.processing = false;
      }
    },

    /**
     * Make a single board accessible
     * @param {Object} board - Parsed board object
     */
    makeAccessible(board) {
      // Store original for potential restore
      this.originalBoards.push({
        container: board.container,
        display: board.container.style.display
      });

      // Create accessible container
      const accessibleContainer = document.createElement('div');
      accessibleContainer.className = 'd4a-accessible-board';
      accessibleContainer.setAttribute('role', 'region');

      // Generate heading
      const heading = document.createElement('h2');
      heading.className = 'd4a-board-heading';
      heading.id = `d4a-board-${board.index}`;
      let headingText = `Board ${board.index}: ${board.fullName || board.name}`;
      // Only show rotation info for mobalytics (maxroll data is pre-rotated)
      if (this.site === 'mobalytics') {
        const rotationText = TableGenerator.formatRotation(board.rotation || 0);
        headingText += `. ${rotationText}`;
      }
      heading.textContent = headingText;
      accessibleContainer.appendChild(heading);

      // Add stats info (as separate element to avoid NVDA reading caption twice)
      const statsContent = TableGenerator.generateCaptionContent(board);
      if (statsContent) {
        const statsInfo = document.createElement('p');
        statsInfo.className = 'd4a-stats-info';
        statsInfo.textContent = statsContent;
        accessibleContainer.appendChild(statsInfo);
      }

      // Generate the accessible table
      const table = TableGenerator.generateTable(board);
      accessibleContainer.appendChild(table);

      // Generate selected nodes summary
      const summary = TableGenerator.generateSelectedSummary(board);
      accessibleContainer.appendChild(summary);

      // Find the best insertion point
      const widgetContainer = board.container.closest('.m-jnyrm6, .m-oy69id, .m-1wir8p5');
      const insertionPoint = widgetContainer || board.container;

      // Insert accessible version before original
      if (insertionPoint.parentNode) {
        insertionPoint.parentNode.insertBefore(accessibleContainer, insertionPoint);
      }

      // Hide original board (keep in DOM for potential data needs)
      insertionPoint.style.display = 'none';
      insertionPoint.setAttribute('aria-hidden', 'true');
    },

    /**
     * Add navigation landmarks between boards
     * @param {Array} boards - Array of board objects
     */
    addNavigationLandmarks(boards) {
      if (boards.length <= 1) return;

      // Add "skip to next board" links
      const boardHeadings = document.querySelectorAll('.d4a-board-heading');

      boardHeadings.forEach((heading, index) => {
        if (index < boards.length - 1) {
          const skipLink = document.createElement('a');
          skipLink.href = `#d4a-board-${index + 2}`;
          skipLink.className = 'd4a-skip-link';
          skipLink.textContent = 'Skip to next board';
          heading.parentNode.insertBefore(skipLink, heading.nextSibling);
        }
      });

      // Add a navigation region at the top
      const nav = document.createElement('nav');
      nav.className = 'd4a-board-nav';

      const navHeading = document.createElement('h2');
      navHeading.className = 'd4a-nav-heading';
      navHeading.textContent = `${boards.length} Paragon Boards`;
      nav.appendChild(navHeading);

      const navList = document.createElement('ul');
      boards.forEach((board, index) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#d4a-board-${index + 1}`;
        link.textContent = `Board ${index + 1}: ${board.name}`;
        li.appendChild(link);
        navList.appendChild(li);
      });
      nav.appendChild(navList);

      // Insert navigation before first accessible board
      const firstAccessible = document.querySelector('.d4a-accessible-board');
      if (firstAccessible && firstAccessible.parentNode) {
        firstAccessible.parentNode.insertBefore(nav, firstAccessible);
      }
    },

    /**
     * Announce a message to screen readers
     * @param {string} message - Message to announce
     */
    announceToScreenReader(message) {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'd4a-sr-only';
      announcement.textContent = message;

      document.body.appendChild(announcement);

      // Remove after announcement is made
      setTimeout(() => {
        announcement.remove();
      }, 3000);
    },

    /**
     * Restore original boards (for debugging/toggle)
     */
    restoreOriginal() {
      // Remove accessible versions
      document.querySelectorAll('.d4a-accessible-board, .d4a-board-nav').forEach(el => {
        el.remove();
      });

      // Restore original boards
      this.originalBoards.forEach(({ container, display }) => {
        container.style.display = display || '';
        container.removeAttribute('aria-hidden');
      });

      this.originalBoards = [];
      this.processed = false;
    }
  };

  // Initialize when script loads
  D4Accessibility.init();

  // Expose for debugging
  window.D4Accessibility = D4Accessibility;
})();
