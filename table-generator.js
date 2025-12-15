/**
 * D4 Paragon Board Accessible Table Generator
 * Converts parsed paragon board data into screen-reader friendly HTML tables
 */

const TableGenerator = {
  // NOTE: Headings, skip links, and layout are generated in content.js
  // This file provides table generation and helper utilities

  /**
   * Generate an accessible table for a single board
   * @param {Object} board - Parsed board object
   * @returns {HTMLTableElement} The accessible table
   */
  generateTable(board) {
    const table = document.createElement('table');
    table.className = 'd4a-paragon-table';
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-label', `Paragon Board ${board.index}: ${board.name}`);

    // Generate table body with rotation-aware coordinates
    const tbody = document.createElement('tbody');
    const { minRow, maxRow, minCol, maxCol } = board.dimensions;
    const rotation = board.rotation || 0;

    // For 90° or 270° rotation, rows and columns swap in the display
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const isRotated90or270 = (normalizedRotation === 90 || normalizedRotation === 270);

    const displayRows = isRotated90or270 ? (maxCol - minCol + 1) : (maxRow - minRow + 1);
    const displayCols = isRotated90or270 ? (maxRow - minRow + 1) : (maxCol - minCol + 1);

    // Generate data rows with rotated coordinates
    for (let displayRow = 0; displayRow < displayRows; displayRow++) {
      const tr = document.createElement('tr');

      for (let displayCol = 0; displayCol < displayCols; displayCol++) {
        // Transform display coordinates to original grid coordinates
        const { row, col } = this.transformCoordinates(
          displayRow, displayCol,
          minRow, maxRow, minCol, maxCol,
          normalizedRotation
        );

        const node = ParagonParser.getNodeAt(board.grid, row, col);
        const td = this.createDataCell(node, displayRow + 1, displayCol + 1);
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    return table;
  },

  /**
   * Transform display coordinates to original grid coordinates based on rotation
   * This makes the accessible table match the visual rotation of the board
   * @param {number} displayRow - Row in the displayed (rotated) table
   * @param {number} displayCol - Column in the displayed (rotated) table
   * @param {number} minRow - Minimum row in original grid
   * @param {number} maxRow - Maximum row in original grid
   * @param {number} minCol - Minimum column in original grid
   * @param {number} maxCol - Maximum column in original grid
   * @param {number} rotation - Board rotation in degrees (0, 90, 180, 270)
   * @returns {Object} {row, col} in original grid coordinates
   */
  transformCoordinates(displayRow, displayCol, minRow, maxRow, minCol, maxCol, rotation) {
    switch (rotation) {
      case 90:
        // 90° clockwise: bottom-left becomes top-left, top-left becomes top-right
        return {
          row: maxRow - displayCol,
          col: minCol + displayRow
        };
      case 180:
        // 180°: both axes reversed
        return {
          row: maxRow - displayRow,
          col: maxCol - displayCol
        };
      case 270:
        // 270° clockwise (90° counter-clockwise): top-right becomes top-left
        return {
          row: minRow + displayCol,
          col: maxCol - displayRow
        };
      default: // 0° or no rotation
        return {
          row: minRow + displayRow,
          col: minCol + displayCol
        };
    }
  },

  /**
   * Create a header cell
   * @param {string} text - Header text
   * @param {string} scope - 'row' or 'col' or empty
   * @returns {HTMLTableCellElement} The header cell
   */
  createHeaderCell(text, scope = '') {
    const th = document.createElement('th');
    th.className = 'd4a-header-cell';
    th.textContent = text;
    if (scope) {
      th.setAttribute('scope', scope);
    }
    return th;
  },

  /**
   * Create a data cell for a node
   * @param {Object|null} node - Node object or null for empty cell
   * @param {number} row - Display row number (1-based)
   * @param {number} col - Display column number (1-based)
   * @returns {HTMLTableCellElement} The data cell
   */
  createDataCell(node, row, col) {
    const td = document.createElement('td');
    td.className = 'd4a-data-cell';

    if (!node) {
      // Empty cell - no node at this position
      td.classList.add('d4a-empty-cell');
      td.setAttribute('aria-label', 'Empty');
      td.textContent = '';
      return td;
    }

    // Build cell content
    const content = this.buildNodeContent(node);
    td.textContent = content.text;
    td.setAttribute('aria-label', content.ariaLabel);

    // Add CSS classes for styling
    td.classList.add(`d4a-type-${node.type}`);
    if (node.isSelected) {
      td.classList.add('d4a-selected');
    }
    if (node.isGate) {
      td.classList.add('d4a-gate');
    }

    // Store node data for potential interactions
    td.dataset.nodeType = node.type;
    td.dataset.nodeStat = node.stat;
    td.dataset.selected = node.isSelected;

    return td;
  },

  /**
   * Build the text content for a node
   * @param {Object} node - Node object
   * @returns {Object} {text, ariaLabel}
   */
  buildNodeContent(node) {
    const parts = [];

    // Type (Normal, Magic, Rare, Gate, Glyph)
    const typeDisplay = this.formatNodeType(node.type);

    // Stat (Str, Int, etc.)
    const statDisplay = node.stat || '';

    // Build display text
    if (node.isGate) {
      if (node.connectsTo) {
        parts.push(`Gate to Board ${node.connectsTo.index}: ${node.connectsTo.name}`);
      } else {
        parts.push('Gate (no connection)');
      }
    } else if (node.isGlyph || node.type === 'glyph') {
      // Show glyph name if available (e.g., "Glyph: Apostle")
      if (node.glyphName) {
        parts.push(`Glyph: ${node.glyphName}`);
      } else if (statDisplay && statDisplay.startsWith('Glyph:')) {
        parts.push(statDisplay);
      } else {
        parts.push('Glyph Socket');
      }
    } else if (typeDisplay && statDisplay) {
      parts.push(`${typeDisplay} ${statDisplay}`);
    } else if (statDisplay) {
      parts.push(statDisplay);
    } else if (typeDisplay) {
      parts.push(typeDisplay);
    }

    // Add * for selected nodes (screen reader friendly)
    const baseText = parts.join(' ');
    const text = node.isSelected ? `${baseText} *` : baseText;

    // Aria-label with "selected" for screen readers
    const ariaLabel = node.isSelected ? `${baseText}, selected` : baseText;

    return { text, ariaLabel };
  },

  /**
   * Format node type for display
   * @param {string} type - Raw node type
   * @returns {string} Formatted type
   */
  formatNodeType(type) {
    const typeMap = {
      'normal': 'Normal',
      'magic': 'Magic',
      'rare': 'Rare',
      'legendary': 'Legendary',
      'gate': 'Gate',
      'glyph': 'Glyph',
      'unknown': ''
    };
    return typeMap[type.toLowerCase()] || type;
  },

  /**
   * Convert rotation degrees to descriptive text
   * In-game, the rotate button only rotates clockwise (to the right)
   * @param {number} degrees - Rotation in degrees (0, 90, 180, 270)
   * @returns {string} Descriptive rotation text
   */
  formatRotation(degrees) {
    const rotationMap = {
      0: 'No rotation',
      90: 'Rotated right once',
      180: 'Rotated right twice',
      270: 'Rotated right thrice'
    };
    // Handle negative rotations (convert to positive equivalent)
    const normalizedDegrees = ((degrees % 360) + 360) % 360;
    return rotationMap[normalizedDegrees] || `Rotated ${degrees} degrees`;
  },

  /**
   * Generate caption content with board stats
   * @param {Object} board - Board object
   * @returns {string} HTML content for caption
   */
  generateCaptionContent(board) {
    const parts = [];

    // Add stats if available
    const stats = board.stats;
    if (Object.keys(stats).length > 0) {
      const statParts = [];
      if (stats.str) statParts.push(`Str: ${stats.str}`);
      if (stats.int) statParts.push(`Int: ${stats.int}`);
      if (stats.dex) statParts.push(`Dex: ${stats.dex}`);
      if (stats.will) statParts.push(`Will: ${stats.will}`);

      if (statParts.length > 0) {
        parts.push(`Stats: ${statParts.join(', ')}`);
      }
    }

    return parts.join('. ');
  },

  /**
   * Generate a summary of selected nodes
   * @param {Object} board - Board object
   * @returns {HTMLElement} Summary element
   */
  generateSelectedSummary(board) {
    const summary = document.createElement('div');
    summary.className = 'd4a-selected-summary';
    summary.setAttribute('role', 'region');

    const selectedNodes = board.nodes.filter(n => n.isSelected);

    // Count by type
    const typeCounts = {};
    selectedNodes.forEach(node => {
      const type = node.type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const heading = document.createElement('h3');
    heading.textContent = `Selected Nodes: ${selectedNodes.length} total`;
    summary.appendChild(heading);

    if (Object.keys(typeCounts).length > 0) {
      const list = document.createElement('ul');
      Object.entries(typeCounts).forEach(([type, count]) => {
        const li = document.createElement('li');
        li.textContent = `${this.formatNodeType(type)}: ${count}`;
        list.appendChild(li);
      });
      summary.appendChild(list);
    }

    return summary;
  },

  /**
   * Replace the original board container with accessible table
   * @param {Object} board - Board object with container reference
   * @param {HTMLElement} tableContainer - The accessible table container
   */
  replaceBoard(board, tableContainer) {
    const originalContainer = board.container;
    if (originalContainer && originalContainer.parentNode) {
      // Find the parent widget container to replace entirely
      const widgetContainer = originalContainer.closest('.m-jnyrm6, .m-oy69id') || originalContainer;

      // Create wrapper for accessible content
      const wrapper = document.createElement('div');
      wrapper.className = 'd4a-accessible-board';
      wrapper.appendChild(tableContainer);

      // Replace the original with accessible version
      widgetContainer.parentNode.insertBefore(wrapper, widgetContainer);
      widgetContainer.style.display = 'none';
      widgetContainer.setAttribute('aria-hidden', 'true');
    }
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableGenerator;
}
