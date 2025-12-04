/**
 * PatPlacer - Popup Script
 * Handles popup UI logic
 */

(function() {
  'use strict';

  // Check if we're on wplace.live
  async function checkStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isWplace = tab?.url?.includes('wplace.live');
      
      const indicator = document.querySelector('.status-indicator');
      const text = document.querySelector('.status-text');
      
      if (isWplace) {
        indicator.classList.remove('inactive');
        indicator.classList.add('active');
        text.textContent = 'Ready on wplace.live';
      } else {
        indicator.classList.remove('active');
        indicator.classList.add('inactive');
        text.textContent = 'Not on wplace.live';
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', checkStatus);
})();
