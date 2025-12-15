# Mobalytics Accessibility Extension for Diablo 4

A Chrome extension that makes Diablo 4 build guides on [Mobalytics.gg](https://mobalytics.gg) accessible to screen reader users.

## Overview

Mobalytics.gg provides excellent Diablo 4 build guides, but the visual paragon board layouts are not accessible to screen reader users. This extension converts those visual boards into navigable HTML tables that work with screen readers like NVDA, JAWS, and VoiceOver.

## Current Features

### Paragon Board Accessibility

- **Converts visual paragon boards to accessible tables** - Navigate nodes using standard table navigation
- **Board rotation support** - Tables are rotated to match the visual orientation, so "rotated right once" means the table layout matches what sighted users see
- **Gate connections** - Gates show which board they connect to (e.g., "Gate to Board 2: Castle / Exploit")
- **Node information** - Each node shows its type (Normal, Magic, Rare, Legendary) and stat bonus (Str, Int, Dex, Will, Damage, etc.)
- **Selection indicators** - Selected nodes are marked with an asterisk (*) and announced as "selected"
- **Glyph information** - Glyph sockets show the equipped glyph name
- **Board stats summary** - Shows total stats for each board (Str, Int, Dex, Will)
- **Selected nodes summary** - Lists count of selected nodes by type
- **Skip links** - Quickly navigate between boards

### Screen Reader Optimizations

- Clean announcements without redundant text
- Proper heading hierarchy for navigation
- Logical reading order that matches visual layout

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `Mobalytics Accessibility Chrome Extension` folder

## Usage

1. Navigate to any Diablo 4 build guide on Mobalytics.gg
2. The extension automatically converts paragon boards when the page loads
3. Use your screen reader's table navigation to explore the boards
4. Use heading navigation to jump between boards

## Planned Features

- Skill tree accessibility
- Gear/equipment section accessibility
- Aspect recommendations accessibility

## Technical Notes

- The extension only activates on mobalytics.gg
- Original visual boards are hidden but preserved in the DOM
- Board data is parsed from the page's existing HTML structure

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License

## Author
Hadi Rezaei