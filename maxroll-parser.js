/**
 * D4 Paragon Board Parser for Maxroll.gg
 * Extracts paragon node data from Maxroll's D4 Tools DOM structure
 */

const MaxrollParser = {
  // Grid spacing in em units (each node is 1em apart in Maxroll)
  GRID_SPACING: 1,

  // CSS selectors for finding elements
  SELECTORS: {
    embedContainer: '.d4-embed[data-d4-type="paragon"]',  // Main embed container
    paragonView: '.d4t-ParagonView',                      // Paragon view wrapper
    individualBoard: '.d4t-ParagonBoard',                  // Each individual board
    boardName: '.d4t-name',                                // Board name label
    boardIndex: '.d4t-index',                              // Board index number
    glyphName: '.d4t-glyph-name',                          // Glyph name in labels
    statsContainer: '.d4t-stats',                          // Stats summary
    nodeElement: '.d4t-node',                              // All node elements
    glyphSocket: '.d4t-node.d4t-socket',                   // Glyph socket nodes
    glyphImage: '.d4t-glyph',                              // Glyph image element
    nodeIcon: '.d4t-icon'                                  // Node icon element
  },

  // Node type class mappings
  NODE_TYPES: {
    'd4t-r1': 'normal',
    'd4t-r2': 'magic',
    'd4t-r3': 'rare',
    'd4t-r4': 'legendary'  // If exists
  },

  // Icon position to stat mapping (background-position-x values)
  // Corrected based on user testing
  ICON_STAT_MAP: {
    '-53em': 'Str',
    '-54em': 'Int',
    '-55em': 'Dex',
    '-56em': 'Will',
    '-57em': 'Armor',
    '-32em': 'Damage',
    '-34em': 'Life',
    '-15em': 'Resistance',
    '-99em': 'Gate'
  },

  /**
   * Parse all paragon boards on the page
   * @returns {Array} Array of board objects
   */
  parseAllBoards() {
    const boards = [];

    // Find the paragon embed container
    const embedContainer = document.querySelector(this.SELECTORS.embedContainer);

    if (!embedContainer) {
      console.log('[Maxroll Parser] No paragon embed container found');
      return boards;
    }

    // Find individual board elements
    const boardElements = embedContainer.querySelectorAll(this.SELECTORS.individualBoard);

    console.log(`[Maxroll Parser] Found ${boardElements.length} board(s)`);

    boardElements.forEach((boardEl, index) => {
      const board = this.parseBoard(boardEl, index + 1);
      if (board && board.nodes.length > 0) {
        boards.push(board);
      }
    });

    return boards;
  },

  /**
   * Parse a single paragon board
   * @param {Element} boardEl - The board element
   * @param {number} boardIndex - The board number (1-based)
   * @returns {Object} Board data object
   */
  parseBoard(boardEl, boardIndex) {
    const boardInfo = this.parseBoardInfo(boardEl);
    const nodes = this.parseNodes(boardEl);

    // Update glyph socket node with board's glyph name
    if (boardInfo.glyphName) {
      const glyphNode = nodes.find(n => n.isGlyph);
      if (glyphNode) {
        glyphNode.glyphName = boardInfo.glyphName;
        glyphNode.stat = `Glyph: ${boardInfo.glyphName}`;
      }
    }

    const grid = this.buildGrid(nodes);
    const dimensions = this.getGridDimensions(grid);

    // Extract board position from style
    const style = boardEl.getAttribute('style') || '';
    const position = this.parsePosition(style);

    // Calculate rotation based on gate positions and visual edge directions
    const rotation = this.determineBoardRotation(nodes, dimensions);

    console.log(`[Maxroll Parser] Board ${boardIndex} (${boardInfo.name}) rotation: ${rotation}°`);

    return {
      index: boardIndex,
      name: boardInfo.name,
      fullName: boardInfo.fullName,
      stats: boardInfo.stats,
      rotation: rotation,
      position: position,
      nodes: nodes,
      grid: grid,
      dimensions: dimensions,
      container: boardEl
    };
  },

  /**
   * Parse board header information
   * @param {Element} boardEl - The board element
   * @returns {Object} Board info
   */
  parseBoardInfo(boardEl) {
    const info = {
      name: 'Unknown Board',
      fullName: '',
      stats: {}
    };

    // Find board name
    const nameEl = boardEl.querySelector(this.SELECTORS.boardName);
    if (nameEl) {
      info.name = nameEl.textContent.trim();
    }

    // Find board index to build full name
    const indexEl = boardEl.querySelector(this.SELECTORS.boardIndex);
    if (indexEl) {
      info.fullName = `${indexEl.textContent.trim()}. ${info.name}`;
    }

    // Find glyph name
    const glyphNameEl = boardEl.querySelector(this.SELECTORS.glyphName);
    if (glyphNameEl) {
      const glyphName = glyphNameEl.textContent.trim();
      if (glyphName) {
        info.fullName += ` / ${glyphName}`;
        info.glyphName = glyphName;
      }
    }

    // Parse stats from stats container
    const statsEl = boardEl.querySelector(this.SELECTORS.statsContainer);
    if (statsEl) {
      // Stats are in format: "Str: 105" etc
      const statSpans = statsEl.querySelectorAll('span');
      statSpans.forEach(span => {
        const text = span.textContent.trim();
        const match = text.match(/(\w+):\s*(\d+)/);
        if (match) {
          info.stats[match[1].toLowerCase()] = parseInt(match[2], 10);
        }
      });
    }

    return info;
  },

  /**
   * Parse all nodes in a board
   * @param {Element} boardEl - The board element
   * @returns {Array} Array of node objects
   */
  parseNodes(boardEl) {
    const nodes = [];
    const nodeElements = boardEl.querySelectorAll(this.SELECTORS.nodeElement);

    nodeElements.forEach(element => {
      const node = this.parseNodeElement(element);
      if (node) {
        nodes.push(node);
      }
    });

    return nodes;
  },

  /**
   * Parse a single node element
   * @param {Element} element - The node element
   * @returns {Object|null} Node data object
   */
  parseNodeElement(element) {
    const style = element.getAttribute('style') || '';
    const position = this.parsePosition(style);

    if (!position) return null;

    const classList = element.classList;

    // Determine node type from classes
    const nodeType = this.getNodeType(classList);

    // Check if it's a special node type
    const isGate = classList.contains('d4t-gate');
    const isSocket = classList.contains('d4t-socket');
    const isStart = classList.contains('d4t-start');
    const isSelected = classList.contains('d4t-active');

    // Get stat from icon
    let stat = '';
    let glyphName = '';

    if (isGate) {
      stat = 'Gate';
    } else if (isSocket) {
      // Get glyph name from the glyph image
      const glyphEl = element.querySelector(this.SELECTORS.glyphImage);
      if (glyphEl) {
        const glyphStyle = glyphEl.getAttribute('style') || '';
        glyphName = this.parseGlyphName(glyphStyle);
        stat = glyphName ? `Glyph: ${glyphName}` : 'Glyph Socket';
      } else {
        stat = 'Glyph Socket';
      }
    } else {
      // Get stat from icon background position
      const iconEl = element.querySelector(this.SELECTORS.nodeIcon);
      if (iconEl) {
        const iconStyle = iconEl.getAttribute('style') || '';
        stat = this.parseIconStat(iconStyle);
      }
    }

    return {
      element: element,
      position: position,
      gridPosition: this.positionToGrid(position),
      type: isSocket ? 'glyph' : (isGate ? 'gate' : nodeType),
      stat: stat,
      glyphName: glyphName,
      isSelected: isSelected,
      rotation: 0,
      isGate: isGate,
      isGlyph: isSocket,
      isStart: isStart,
      gateEdge: isGate ? this.parseGateEdge(element) : null
    };
  },

  /**
   * Get node type from class list
   * @param {DOMTokenList} classList - Element's class list
   * @returns {string} Node type
   */
  getNodeType(classList) {
    for (const [className, type] of Object.entries(this.NODE_TYPES)) {
      if (classList.contains(className)) {
        return type;
      }
    }
    return 'normal';
  },

  /**
   * Parse gate edge direction from d4t-edge classes
   * @param {Element} element - The gate element
   * @returns {string|null} Direction: 'NORTH', 'SOUTH', 'EAST', 'WEST', or null
   */
  parseGateEdge(element) {
    // Check for edge direction classes within the element
    if (element.querySelector('.d4t-edge.d4t-n')) return 'NORTH';
    if (element.querySelector('.d4t-edge.d4t-s')) return 'SOUTH';
    if (element.querySelector('.d4t-edge.d4t-e')) return 'EAST';
    if (element.querySelector('.d4t-edge.d4t-w')) return 'WEST';
    return null;
  },

  /**
   * Parse icon stat from background-position-x
   * @param {string} style - Style attribute value
   * @returns {string} Stat name
   */
  parseIconStat(style) {
    const match = style.match(/background-position-x:\s*([-\d.]+em)/);
    if (match) {
      const position = match[1];
      return this.ICON_STAT_MAP[position] || '';
    }
    return '';
  },

  /**
   * Parse glyph name from background-image URL
   * @param {string} style - Style attribute value
   * @returns {string} Glyph name
   */
  parseGlyphName(style) {
    // URL format: https://assets-ng.maxroll.gg/d4-tools/images/webp/XXXXX.webp
    // The number is an ID, but we can try to get the name from nearby elements
    // For now, return empty and rely on board info for glyph name
    return '';
  },

  /**
   * Parse position from style string
   * @param {string} style - Style attribute value
   * @returns {Object|null} Position {left, top} in em
   */
  parsePosition(style) {
    const leftMatch = style.match(/left:\s*([-\d.]+)(?:em|px)/);
    const topMatch = style.match(/top:\s*([-\d.]+)(?:em|px)/);

    if (leftMatch && topMatch) {
      return {
        left: parseFloat(leftMatch[1]),
        top: parseFloat(topMatch[1])
      };
    }
    return null;
  },

  /**
   * Convert position to grid coordinates
   * @param {Object} position - Position {left, top}
   * @returns {Object} Grid position {row, col}
   */
  positionToGrid(position) {
    return {
      col: Math.round(position.left / this.GRID_SPACING),
      row: Math.round(position.top / this.GRID_SPACING)
    };
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
   * @returns {Object} Dimensions
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

  /**
   * Determine board rotation based on gate positions and edge directions
   * Maxroll encodes visual direction in d4t-edge classes (n/s/e/w)
   * We compare gate data position to its visual edge direction to calculate rotation
   * @param {Array} nodes - Array of node objects
   * @param {Object} dimensions - Grid dimensions
   * @returns {number} Rotation in degrees (0, 90, 180, 270)
   */
  determineBoardRotation(nodes, dimensions) {
    // Find active gates (gates with d4t-active class have connections)
    const gates = nodes.filter(n => n.isGate && n.gateEdge);

    if (gates.length === 0) return 0;

    // Use the first gate to determine rotation
    // Compare its data position (which edge of the grid it's on) to its visual edge direction
    for (const gate of gates) {
      const dataEdge = this.getDataEdge(gate.gridPosition, dimensions);
      const visualEdge = gate.gateEdge;

      if (!dataEdge || !visualEdge) continue;

      // Calculate rotation needed to transform dataEdge to visualEdge
      const rotation = this.calculateRotation(dataEdge, visualEdge);
      return rotation;
    }

    return 0;
  },

  /**
   * Determine which edge of the grid a position is on based on data coordinates
   * @param {Object} gridPos - Grid position {row, col}
   * @param {Object} dimensions - Grid dimensions {minRow, maxRow, minCol, maxCol}
   * @returns {string|null} Edge: 'NORTH', 'SOUTH', 'EAST', 'WEST', or null
   */
  getDataEdge(gridPos, dimensions) {
    const { row, col } = gridPos;
    const { minRow, maxRow, minCol, maxCol } = dimensions;

    // Check if position is at an edge
    const atTop = row === minRow;
    const atBottom = row === maxRow;
    const atLeft = col === minCol;
    const atRight = col === maxCol;

    // Prioritize vertical edges (top/bottom) over horizontal for typical board layouts
    if (atTop) return 'NORTH';
    if (atBottom) return 'SOUTH';
    if (atLeft) return 'WEST';
    if (atRight) return 'EAST';

    return null;
  },

  /**
   * Calculate rotation needed to transform from data edge to visual edge
   * @param {string} dataEdge - Edge based on data position (where gate is in data grid)
   * @param {string} visualEdge - Edge based on d4t-edge class (direction gate connects to)
   * @returns {number} Rotation in degrees
   */
  calculateRotation(dataEdge, visualEdge) {
    // For a standard (unrotated) board:
    // - Gate at NORTH position connects SOUTH (opposite direction)
    // - Gate at SOUTH position connects NORTH
    // - Gate at EAST position connects WEST
    // - Gate at WEST position connects EAST

    const edges = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
    const dataIndex = edges.indexOf(dataEdge);
    const visualIndex = edges.indexOf(visualEdge);

    if (dataIndex === -1 || visualIndex === -1) return 0;

    // Expected connection direction is OPPOSITE of gate position
    // NORTH (0) -> expected SOUTH (2), EAST (1) -> expected WEST (3), etc.
    const expectedIndex = (dataIndex + 2) % 4;

    // Calculate how many 90° steps the board is rotated from standard
    const steps = (visualIndex - expectedIndex + 4) % 4;

    return steps * 90;
  },

  /**
   * Calculate gate connections between boards
   * Uses gate edge directions (N/S/E/W) to match complementary gates
   * @param {Array} boards - Array of all parsed boards
   */
  calculateGateConnections(boards) {
    // Gate connection detection is not reliable on Maxroll
    // Just leave connectsTo as null for all gates
    return;

    // Complementary directions mapping
    const complementary = {
      'NORTH': 'SOUTH',
      'SOUTH': 'NORTH',
      'EAST': 'WEST',
      'WEST': 'EAST'
    };

    // Log all boards and their gates for debugging
    console.log('[Maxroll Parser] Gate analysis:');
    boards.forEach((board, idx) => {
      const gates = board.nodes.filter(n => n.isGate);
      gates.forEach(g => {
        console.log(`  Board ${board.index}: gate at (${g.gridPosition.row},${g.gridPosition.col}), edge=${g.gateEdge}, active=${g.isSelected}`);
      });
    });

    boards.forEach((board, boardIndex) => {
      board.nodes.forEach(node => {
        if (!node.isGate) return;

        // Only active gates have connections
        if (!node.isSelected) {
          node.connectsTo = null;
          return;
        }

        const gateEdge = node.gateEdge;
        if (!gateEdge) {
          console.log(`[Maxroll Parser] Board ${board.index} gate has no edge direction!`);
          node.connectsTo = null;
          return;
        }

        // Find the board that this gate connects to
        // Gates connect to adjacent boards in the chain
        let connectedBoard = null;

        // Look for complementary gate in adjacent boards
        const expectedEdge = complementary[gateEdge];

        // Check previous board (board N-1)
        if (boardIndex > 0) {
          const prevBoard = boards[boardIndex - 1];
          const matchingGate = this.findGateWithEdge(prevBoard, expectedEdge);
          console.log(`[Maxroll Parser] Checking prev board ${prevBoard.index} for ${expectedEdge} gate: ${matchingGate ? `found (active=${matchingGate.isSelected})` : 'not found'}`);
          if (matchingGate && matchingGate.isSelected) {
            connectedBoard = prevBoard;
          }
        }

        // Check next board (board N+1) if not found in previous
        if (!connectedBoard && boardIndex < boards.length - 1) {
          const nextBoard = boards[boardIndex + 1];
          const matchingGate = this.findGateWithEdge(nextBoard, expectedEdge);
          console.log(`[Maxroll Parser] Checking next board ${nextBoard.index} for ${expectedEdge} gate: ${matchingGate ? `found (active=${matchingGate.isSelected})` : 'not found'}`);
          if (matchingGate && matchingGate.isSelected) {
            connectedBoard = nextBoard;
          }
        }

        node.connectsTo = connectedBoard ? {
          index: connectedBoard.index,
          name: connectedBoard.name
        } : null;

        console.log(`[Maxroll Parser] Board ${board.index} gate (${gateEdge}) -> ${connectedBoard ? `Board ${connectedBoard.index} (${connectedBoard.name})` : 'NO CONNECTION'}`);
      });
    });
  },

  /**
   * Find a gate in a board with a specific edge direction
   * @param {Object} board - Board to search
   * @param {string} edge - Edge direction to find
   * @returns {Object|null} Gate node or null
   */
  findGateWithEdge(board, edge) {
    return board.nodes.find(n => n.isGate && n.gateEdge === edge) || null;
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MaxrollParser;
}
