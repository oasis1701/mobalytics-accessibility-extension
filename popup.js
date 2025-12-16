/**
 * D4 Paragon Accessibility Extension
 * Popup script - shows extension status
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status-value');

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      statusEl.textContent = 'Unable to check tab';
      statusEl.className = 'status-value status-inactive';
      return;
    }

    // Check if we're on a supported page
    const url = tab.url || '';
    const isMobalytics = url.includes('mobalytics.gg/diablo-4');
    const isMaxroll = url.includes('maxroll.gg/d4');

    if (!isMobalytics && !isMaxroll) {
      statusEl.textContent = 'Not a D4 build guide page';
      statusEl.className = 'status-value status-inactive';
      return;
    }

    const siteName = isMobalytics ? 'Mobalytics' : 'Maxroll';

    // Try to check if extension has processed the page
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Check if our accessible boards exist
          const accessibleBoards = document.querySelectorAll('.d4a-accessible-board');
          return accessibleBoards.length;
        }
      });

      const boardCount = results[0]?.result || 0;

      if (boardCount > 0) {
        statusEl.textContent = `Active on ${siteName} - ${boardCount} board${boardCount > 1 ? 's' : ''} converted`;
        statusEl.className = 'status-value status-active';
      } else {
        statusEl.textContent = `On ${siteName} - Waiting for paragon boards...`;
        statusEl.className = 'status-value status-inactive';
      }
    } catch (scriptError) {
      // Script injection might fail if page hasn't loaded yet
      statusEl.textContent = 'Page loading...';
      statusEl.className = 'status-value status-inactive';
    }
  } catch (error) {
    console.error('Popup error:', error);
    statusEl.textContent = 'Error checking status';
    statusEl.className = 'status-value status-inactive';
  }
});
