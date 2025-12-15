/**
 * D4 Paragon Board Parser
 * Extracts paragon node data from Mobalytics DOM structure
 */

const ParagonParser = {
  // Grid spacing in em units (each node is 8em apart)
  GRID_SPACING: 8,

  // CSS selectors for finding elements
  SELECTORS: {
    boardContainer: '.m-v6dz1q',       // Main container holding all boards
    individualBoard: '.m-aaq75x',       // Each individual board wrapper
    boardInfo: '.m-3chuo9',
    boardNumber: '.m-1d0rmc8',
    boardName: '.m-17m3tzo',
    statsContainer: '.m-eo9294',
    statItem: '.m-cbv9eh',
    nodeElement: '.m-k2g3k7',
    gateElement: '.m-1hjt9lz',
    glyphSocket: '.m-1vtacco'            // Glyph socket elements (center of board)
  },

  // Regex patterns for extracting data from URLs
  PATTERNS: {
    nodeType: /board-icons\/v2\/([^.?]+)\.png/,
    nodeStat: /nodes\/([^.?]+)\.png/,
    glyphName: /glyphs\/[^-]+-([^.?]+)\.png/    // e.g., glyphs/paladin-apostle.png -> apostle
  },

  /**
   * Parse all paragon boards on the page
   * @returns {Array} Array of board objects
   */
  parseAllBoards() {
    const boards = [];

    // Find the main container that holds all boards
    const mainContainer = document.querySelector(this.SELECTORS.boardContainer);

    if (!mainContainer) {
      console.log('[D4 Parser] No main board container found');
      return boards;
    }

    // Find individual board wrappers within the main container
    const boardWrappers = mainContainer.querySelectorAll(this.SELECTORS.individualBoard);

    console.log(`[D4 Parser] Found ${boardWrappers.length} individual board wrapper(s)`);

    boardWrappers.forEach((wrapper, index) => {
      const board = this.parseBoard(wrapper, index + 1);
      if (board && board.nodes.length > 0) {
        boards.push(board);
      }
    });

    return boards;
  },

  /**
   * Parse a single paragon board
   * @param {Element} container - The board container element
   * @param {number} boardIndex - The board number (1-based)
   * @returns {Object} Board data object
   */
  parseBoard(container, boardIndex) {
    const boardInfo = this.parseBoardInfo(container);
    const nodes = this.parseNodes(container);
    const gates = this.parseGates(container);
    const glyphSockets = this.parseGlyphSockets(container);
    // IMPORTANT: Add glyph sockets FIRST so that gates/nodes can overwrite them
    // (glyph socket backgrounds exist at same position as gates)
    const allNodes = [...glyphSockets, ...nodes, ...gates];
    const grid = this.buildGrid(allNodes);

    // Extract board-level rotation and position from container style
    const containerStyle = container.getAttribute('style') || '';
    const boardRotation = this.parseRotation(containerStyle);
    const boardPosition = this.parsePosition(containerStyle);

    return {
      index: boardIndex,
      name: boardInfo.name,
      fullName: boardInfo.fullName,
      stats: boardInfo.stats,
      rotation: boardRotation,
      position: boardPosition,
      nodes: allNodes,
      grid: grid,
      dimensions: this.getGridDimensions(grid),
      container: container
    };
  },

  /**
   * Parse board header information
   * @param {Element} container - The board container
   * @returns {Object} Board info
   */
  parseBoardInfo(container) {
    const info = {
      name: 'Unknown Board',
      fullName: '',
      stats: {}
    };

    // Find board name
    const boardNameEl = container.querySelector(this.SELECTORS.boardName);
    if (boardNameEl) {
      info.name = boardNameEl.textContent.trim();
    }

    // Find full board name (may include "Starter Board / Name")
    const boardNumberEl = container.querySelector(this.SELECTORS.boardNumber);
    if (boardNumberEl) {
      const parent = boardNumberEl.closest('.m-1a5dabi, .m-bxzyue');
      if (parent) {
        info.fullName = parent.textContent.trim();
      }
    }

    // Parse stats
    const statsContainer = container.querySelector(this.SELECTORS.statsContainer);
    if (statsContainer) {
      const statItems = statsContainer.querySelectorAll(this.SELECTORS.statItem);
      statItems.forEach(item => {
        const text = item.textContent.trim();
        const match = text.match(/(\w+):(\d+)/);
        if (match) {
          info.stats[match[1].toLowerCase()] = parseInt(match[2], 10);
        }
      });
    }

    return info;
  },

  /**
   * Parse all node elements in a board
   * @param {Element} container - The board container
   * @returns {Array} Array of node objects
   */
  parseNodes(container) {
    const nodes = [];
    const nodeElements = container.querySelectorAll(this.SELECTORS.nodeElement);

    nodeElements.forEach(element => {
      const node = this.parseNodeElement(element);
      if (node) {
        nodes.push(node);
      }
    });

    return nodes;
  },

  /**
   * Parse gate elements (board connectors)
   * @param {Element} container - The board container
   * @returns {Array} Array of gate objects
   */
  parseGates(container) {
    const gates = [];
    const gateElements = container.querySelectorAll(this.SELECTORS.gateElement);

    gateElements.forEach(element => {
      const gate = this.parseNodeElement(element, true);
      if (gate) {
        gate.isGate = true;
        gates.push(gate);
      }
    });

    return gates;
  },

  /**
   * Parse glyph socket elements
   * @param {Element} container - The board container
   * @returns {Array} Array of glyph socket objects
   */
  parseGlyphSockets(container) {
    const sockets = [];
    const socketElements = container.querySelectorAll(this.SELECTORS.glyphSocket);

    socketElements.forEach(element => {
      const style = element.getAttribute('style') || '';
      const position = this.parsePosition(style);

      if (position) {
        // Get the span's style to extract glyph name
        const span = element.querySelector('span') || element;
        const spanStyle = span.getAttribute('style') || '';
        const glyphName = this.parseGlyphName(spanStyle);

        sockets.push({
          element: element,
          position: position,
          gridPosition: this.positionToGrid(position),
          type: 'glyph',
          stat: glyphName ? `Glyph: ${glyphName}` : 'Glyph Socket',
          glyphName: glyphName,
          isSelected: true,  // Glyph sockets are always "active" if visible
          rotation: this.parseRotation(style),
          isGate: false,
          isGlyph: true
        });
      }
    });

    return sockets;
  },

  /**
   * Parse glyph name from background-image URL
   * @param {string} style - The style attribute value
   * @returns {string} Glyph name or empty string
   */
  parseGlyphName(style) {
    const match = style.match(this.PATTERNS.glyphName);
    if (match) {
      // Capitalize first letter
      const name = match[1];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return '';
  },

  /**
   * Parse a single node/gate element
   * @param {Element} element - The node element
   * @param {boolean} isGate - Whether this is a gate element
   * @returns {Object|null} Node data object
   */
  parseNodeElement(element, isGate = false) {
    const style = element.getAttribute('style') || '';
    const position = this.parsePosition(style);

    if (!position) return null;

    // Find the span with background-image
    const span = element.querySelector('span') || element;
    const spanStyle = span.getAttribute('style') || '';

    const nodeType = this.parseNodeType(spanStyle, isGate);
    const nodeStat = this.parseNodeStat(spanStyle);
    const isSelected = this.parseSelectionState(spanStyle);
    const rotation = this.parseRotation(style);

    return {
      element: element,
      position: position,
      gridPosition: this.positionToGrid(position),
      type: nodeType,
      stat: nodeStat,
      isSelected: isSelected,
      rotation: rotation,
      isGate: isGate
    };
  },

  /**
   * Parse position from style string
   * @param {string} style - The style attribute value
   * @returns {Object|null} Position object {left, top} in em
   */
  parsePosition(style) {
    const leftMatch = style.match(/left:\s*([-\d.]+)em/);
    const topMatch = style.match(/top:\s*([-\d.]+)em/);

    if (leftMatch && topMatch) {
      return {
        left: parseFloat(leftMatch[1]),
        top: parseFloat(topMatch[1])
      };
    }
    return null;
  },

  /**
   * Parse rotation from style string
   * @param {string} style - The style attribute value
   * @returns {number} Rotation in degrees
   */
  parseRotation(style) {
    const match = style.match(/rotate\(([-\d.]+)deg\)/);
    return match ? parseFloat(match[1]) : 0;
  },

  /**
   * Convert em position to grid row/column
   * @param {Object} position - Position in em {left, top}
   * @returns {Object} Grid position {row, col}
   */
  positionToGrid(position) {
    return {
      col: Math.round(position.left / this.GRID_SPACING),
      row: Math.round(position.top / this.GRID_SPACING)
    };
  },

  /**
   * Parse node type from background-image URL
   * @param {string} style - The style attribute value
   * @param {boolean} isGate - Whether this is a gate element
   * @returns {string} Node type
   */
  parseNodeType(style, isGate = false) {
    if (isGate) return 'gate';

    const match = style.match(this.PATTERNS.nodeType);
    if (match) {
      // Remove -active suffix for consistent type naming
      return match[1].replace(/-active$/, '');
    }
    return 'unknown';
  },

  /**
   * Parse node stat from background-image URL
   * @param {string} style - The style attribute value
   * @returns {string} Node stat
   */
  parseNodeStat(style) {
    const match = style.match(this.PATTERNS.nodeStat);
    if (match) {
      // Remove -active suffix and normalize
      let stat = match[1].replace(/-active$/, '');
      return this.normalizeStatName(stat);
    }
    return '';
  },

  /**
   * Normalize stat names to readable format
   * @param {string} stat - Raw stat name
   * @returns {string} Normalized stat name
   */
  normalizeStatName(stat) {
    const statMap = {
      'str': 'Str',
      'int': 'Int',
      'dex': 'Dex',
      'will': 'Will',
      'damage': 'Damage',
      'damagetoelite': 'Elite Damage',
      'damagereduction': 'Damage Reduction',
      'armor': 'Armor',
      'resistance': 'Resistance',
      'life': 'Life',
      'gate': 'Gate'
    };
    return statMap[stat.toLowerCase()] || stat;
  },

  /**
   * Parse selection state from style
   * The selection indicator is the "-active" suffix in the node stat URL
   * Example: nodes/str-active.png = selected, nodes/str.png = not selected
   * @param {string} style - The style attribute value
   * @returns {boolean} Whether the node is selected
   */
  parseSelectionState(style) {
    // Check for -active suffix in the node stat URL (first background-image)
    // Pattern: /nodes/STAT-active.png means selected
    const hasActiveStat = /nodes\/[^/]+-active\.png/.test(style);
    return hasActiveStat;
  },

  /**
   * Build a 2D grid from nodes
   * @param {Array} nodes - Array of node objects
   * @returns {Object} Grid object mapping row,col to node
   */
  buildGrid(nodes) {
    const grid = {};

    nodes.forEach(node => {
      const key = `${node.gridPosition.row},${node.gridPosition.col}`;
      grid[key] = node;
    });

    return grid;
  },

  /**
   * Get grid dimensions
   * @param {Object} grid - Grid object
   * @returns {Object} Dimensions {minRow, maxRow, minCol, maxCol, rows, cols}
   */
  getGridDimensions(grid) {
    const positions = Object.keys(grid).map(key => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });

    if (positions.length === 0) {
      return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, rows: 0, cols: 0 };
    }

    const minRow = Math.min(...positions.map(p => p.row));
    const maxRow = Math.max(...positions.map(p => p.row));
    const minCol = Math.min(...positions.map(p => p.col));
    const maxCol = Math.max(...positions.map(p => p.col));

    return {
      minRow,
      maxRow,
      minCol,
      maxCol,
      rows: maxRow - minRow + 1,
      cols: maxCol - minCol + 1
    };
  },

  /**
   * Get a node at a specific grid position
   * @param {Object} grid - Grid object
   * @param {number} row - Row index
   * @param {number} col - Column index
   * @returns {Object|null} Node at position or null
   */
  getNodeAt(grid, row, col) {
    return grid[`${row},${col}`] || null;
  },

  // ============================================
  // Gate Connection Calculation
  // ============================================

  // Board size in em units (spacing between boards)
  BOARD_SIZE: 168,

  /**
   * Calculate which board each gate connects to
   * Must be called after all boards are parsed
   * @param {Array} boards - Array of all parsed board objects
   */
  calculateGateConnections(boards) {
    boards.forEach(board => {
      board.nodes.forEach(node => {
        if (!node.isGate) return;

        // Determine which edge this gate is on (before rotation)
        const gateEdge = this.getGateEdge(node.position);

        // Account for board rotation to get actual direction
        const actualDirection = this.rotateDirection(gateEdge, board.rotation);

        // Find adjacent board in that direction
        const connectedBoard = this.findAdjacentBoard(boards, board, actualDirection);

        // Attach connection info to gate
        node.connectsTo = connectedBoard ? {
          index: connectedBoard.index,
          name: (connectedBoard.fullName || connectedBoard.name).replace(/^\d+/, '')
        } : null;
      });
    });
  },

  /**
   * Determine which edge a gate is on based on its position
   * @param {Object} position - Gate position {left, top} in em
   * @returns {string} Edge name: 'TOP', 'RIGHT', 'BOTTOM', or 'LEFT'
   */
  getGateEdge(position) {
    // Gate positions within a board (fixed coordinates)
    // TOP: left: 80em, top: 0em
    // RIGHT: left: 160em, top: 80em
    // BOTTOM: left: 80em, top: 160em
    // LEFT: left: 0em, top: 80em

    if (position.top === 0) return 'TOP';
    if (position.left === 160) return 'RIGHT';
    if (position.top === 160) return 'BOTTOM';
    if (position.left === 0) return 'LEFT';

    // Fallback based on closest edge
    if (position.top < 40) return 'TOP';
    if (position.left > 120) return 'RIGHT';
    if (position.top > 120) return 'BOTTOM';
    return 'LEFT';
  },

  /**
   * Apply rotation to a direction
   * @param {string} edge - Original edge ('TOP', 'RIGHT', 'BOTTOM', 'LEFT')
   * @param {number} rotation - Rotation in degrees (0, 90, 180, 270)
   * @returns {string} Actual direction after rotation
   */
  rotateDirection(edge, rotation) {
    const directions = ['TOP', 'RIGHT', 'BOTTOM', 'LEFT'];
    const edgeIndex = directions.indexOf(edge);

    // Normalize rotation to 0, 90, 180, 270
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const rotationSteps = normalizedRotation / 90;

    // Rotate clockwise
    const newIndex = (edgeIndex + rotationSteps) % 4;
    return directions[newIndex];
  },

  /**
   * Find the board adjacent to the current board in the given direction
   * @param {Array} boards - All parsed boards
   * @param {Object} currentBoard - The board we're checking from
   * @param {string} direction - Direction to look ('TOP', 'RIGHT', 'BOTTOM', 'LEFT')
   * @returns {Object|null} Adjacent board or null if none found
   */
  findAdjacentBoard(boards, currentBoard, direction) {
    if (!currentBoard.position) return null;

    const currentLeft = currentBoard.position.left;
    const currentTop = currentBoard.position.top;

    // Calculate expected position of adjacent board
    let expectedLeft = currentLeft;
    let expectedTop = currentTop;

    switch (direction) {
      case 'TOP':
        expectedTop = currentTop - this.BOARD_SIZE;
        break;
      case 'RIGHT':
        expectedLeft = currentLeft + this.BOARD_SIZE;
        break;
      case 'BOTTOM':
        expectedTop = currentTop + this.BOARD_SIZE;
        break;
      case 'LEFT':
        expectedLeft = currentLeft - this.BOARD_SIZE;
        break;
    }

    // Find board at expected position (with small tolerance for rounding)
    return boards.find(board => {
      if (!board.position || board.index === currentBoard.index) return false;
      const leftMatch = Math.abs(board.position.left - expectedLeft) < 10;
      const topMatch = Math.abs(board.position.top - expectedTop) < 10;
      return leftMatch && topMatch;
    }) || null;
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ParagonParser;
}
