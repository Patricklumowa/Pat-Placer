/**
 * PatPlacer - Content Script
 * Injects PatPlacer button into wplace.live toolbar
 * Runs in isolated world, communicates with background via messages
 */

// Check if we're on wplace.live
if (window.location.hostname === 'wplace.live') {

  const BUTTON_ID = 'patplacer-btn';
  const IMAGE_PROCESSOR_SCRIPT = 'image-processor.js';
  const MAIN_SCRIPT = 'patplacer-main.js';
  const CSS_FILE = 'patplacer.css';
  
  let patplacerButton = null;
  let isInjected = false;
  let buttonHiddenByModal = false;
  let buttonRemoved = false;

  // Check if any modal is open
  function isAnyModalOpen() {
    const modals = document.querySelectorAll('dialog.modal[open], dialog[open]');
    return modals.length > 0;
  }

  // Handle button visibility based on modals
  function handleButtonVisibility() {
    if (!patplacerButton || buttonRemoved) return;

    if (isAnyModalOpen()) {
      if (!buttonHiddenByModal) {
        buttonHiddenByModal = true;
        patplacerButton.style.transition = 'all 0.3s ease-out';
        patplacerButton.style.opacity = '0';
        patplacerButton.style.transform = 'scale(0.8)';
        patplacerButton.style.pointerEvents = 'none';
      }
    } else {
      if (buttonHiddenByModal) {
        buttonHiddenByModal = false;
        patplacerButton.style.transition = 'all 0.3s ease-in';
        patplacerButton.style.opacity = '1';
        patplacerButton.style.transform = 'scale(1)';
        patplacerButton.style.pointerEvents = 'auto';
      }
    }
  }

  /**
   * Handle button click - inject main PatPlacer script
   */
  async function handleButtonClick() {
    if (isInjected) {
      // Toggle visibility of existing panel
      window.postMessage({ source: 'patplacer-content', action: 'togglePanel' }, '*');
      return;
    }

    // Show loading state
    patplacerButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5 animate-spin">
        <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
      </svg>
    `;
    patplacerButton.style.opacity = '0.7';

    console.log('[PatPlacer] Button clicked, injecting scripts...');

    try {
      // Inject CSS first
      await chrome.runtime.sendMessage({
        action: 'injectCSS',
        cssName: CSS_FILE
      });
      
      // Inject image processor module
      await chrome.runtime.sendMessage({
        action: 'executeScript',
        scriptName: IMAGE_PROCESSOR_SCRIPT
      });

      // Then inject main script
      await chrome.runtime.sendMessage({
        action: 'executeScript',
        scriptName: MAIN_SCRIPT
      });

      isInjected = true;
      console.log('[PatPlacer] Scripts injected successfully');

      // Update button to show success/active state
      patplacerButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
          <path d="M5,3H7V5H5V10A2,2 0 0,1 3,12A2,2 0 0,1 5,14V19H7V21H5C3.93,20.73 3,20.1 3,19V15A2,2 0 0,0 1,13H0V11H1A2,2 0 0,0 3,9V5A2,2 0 0,1 5,3M19,3A2,2 0 0,1 21,5V9A2,2 0 0,0 23,11H24V13H23A2,2 0 0,0 21,15V19A2,2 0 0,1 19,21H17V19H19V14A2,2 0 0,1 21,12A2,2 0 0,1 19,10V5H17V3H19M12,15A1,1 0 0,1 13,16A1,1 0 0,1 12,17A1,1 0 0,1 11,16A1,1 0 0,1 12,15M8,15A1,1 0 0,1 9,16A1,1 0 0,1 8,17A1,1 0 0,1 7,16A1,1 0 0,1 8,15M16,15A1,1 0 0,1 17,16A1,1 0 0,1 16,17A1,1 0 0,1 15,16A1,1 0 0,1 16,15Z"/>
        </svg>
      `;
      patplacerButton.style.opacity = '1';
      patplacerButton.style.background = '#667eea';
      patplacerButton.title = 'PatPlacer - Click to toggle panel';

    } catch (error) {
      console.error('[PatPlacer] Failed to inject scripts:', error);
      
      // Show error state
      patplacerButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
          <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
        </svg>
      `;
      patplacerButton.style.background = '#f44336';
      patplacerButton.title = 'Error loading PatPlacer - Click to retry';
      
      // Reset after 3 seconds
      setTimeout(() => {
        resetButton();
      }, 3000);
    }
  }

  /**
   * Reset button to initial state
   */
  function resetButton() {
    if (patplacerButton) {
      patplacerButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
          <path d="M5,3H7V5H5V10A2,2 0 0,1 3,12A2,2 0 0,1 5,14V19H7V21H5C3.93,20.73 3,20.1 3,19V15A2,2 0 0,0 1,13H0V11H1A2,2 0 0,0 3,9V5A2,2 0 0,1 5,3M19,3A2,2 0 0,1 21,5V9A2,2 0 0,0 23,11H24V13H23A2,2 0 0,0 21,15V19A2,2 0 0,1 19,21H17V19H19V14A2,2 0 0,1 21,12A2,2 0 0,1 19,10V5H17V3H19M12,15A1,1 0 0,1 13,16A1,1 0 0,1 12,17A1,1 0 0,1 11,16A1,1 0 0,1 12,15M8,15A1,1 0 0,1 9,16A1,1 0 0,1 8,17A1,1 0 0,1 7,16A1,1 0 0,1 8,15M16,15A1,1 0 0,1 17,16A1,1 0 0,1 16,17A1,1 0 0,1 15,16A1,1 0 0,1 16,15Z"/>
        </svg>
      `;
      patplacerButton.style.background = '';
      patplacerButton.title = 'PatPlacer - Click to place pixel drafts';
      isInjected = false;
    }
  }

  /**
   * Create the PatPlacer button - same style as WPlace-AutoBOT
   */
  function createPatPlacerButton() {
    if (buttonRemoved) return;
    
    // Find the menu container - same selector as WPlace-AutoBOT
    const menuContainer = document.querySelector('.absolute.right-2.top-2.z-30 .flex.flex-col.gap-3.items-center');

    if (!menuContainer) {
      // Retry after 1 second if container not found
      setTimeout(createPatPlacerButton, 1000);
      return;
    }

    // Check if button already exists
    if (document.getElementById(BUTTON_ID)) {
      patplacerButton = document.getElementById(BUTTON_ID);
      return;
    }

    // Create button with same structure as WPlace-AutoBOT
    patplacerButton = document.createElement('button');
    patplacerButton.id = BUTTON_ID;
    patplacerButton.className = 'btn btn-square shadow-md';
    
    // Use different icon and style if already injected
    if (isInjected) {
      patplacerButton.title = 'PatPlacer - Click to toggle panel';
      patplacerButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
          <path d="M5,3H7V5H5V10A2,2 0 0,1 3,12A2,2 0 0,1 5,14V19H7V21H5C3.93,20.73 3,20.1 3,19V15A2,2 0 0,0 1,13H0V11H1A2,2 0 0,0 3,9V5A2,2 0 0,1 5,3M19,3A2,2 0 0,1 21,5V9A2,2 0 0,0 23,11H24V13H23A2,2 0 0,0 21,15V19A2,2 0 0,1 19,21H17V19H19V14A2,2 0 0,1 21,12A2,2 0 0,1 19,10V5H17V3H19M12,15A1,1 0 0,1 13,16A1,1 0 0,1 12,17A1,1 0 0,1 11,16A1,1 0 0,1 12,15M8,15A1,1 0 0,1 9,16A1,1 0 0,1 8,17A1,1 0 0,1 7,16A1,1 0 0,1 8,15M16,15A1,1 0 0,1 17,16A1,1 0 0,1 16,17A1,1 0 0,1 15,16A1,1 0 0,1 16,15Z"/>
        </svg>
      `;
      patplacerButton.style.cssText = `
        transition: all 0.2s ease;
        background: #667eea;
      `;
    } else {
      patplacerButton.title = 'PatPlacer - Click to place pixel drafts';
      patplacerButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
          <path d="M5,3H7V5H5V10A2,2 0 0,1 3,12A2,2 0 0,1 5,14V19H7V21H5C3.93,20.73 3,20.1 3,19V15A2,2 0 0,0 1,13H0V11H1A2,2 0 0,0 3,9V5A2,2 0 0,1 5,3M19,3A2,2 0 0,1 21,5V9A2,2 0 0,0 23,11H24V13H23A2,2 0 0,0 21,15V19A2,2 0 0,1 19,21H17V19H19V14A2,2 0 0,1 21,12A2,2 0 0,1 19,10V5H17V3H19M12,15A1,1 0 0,1 13,16A1,1 0 0,1 12,17A1,1 0 0,1 11,16A1,1 0 0,1 12,15M8,15A1,1 0 0,1 9,16A1,1 0 0,1 8,17A1,1 0 0,1 7,16A1,1 0 0,1 8,15M16,15A1,1 0 0,1 17,16A1,1 0 0,1 16,17A1,1 0 0,1 15,16A1,1 0 0,1 16,15Z"/>
        </svg>
      `;
      patplacerButton.style.cssText = `
        transition: all 0.2s ease;
      `;
    }

    // Click handler
    patplacerButton.addEventListener('click', handleButtonClick);

    // Append to container (same position as AutoBOT)
    menuContainer.appendChild(patplacerButton);

    console.log('[PatPlacer] Button injected into toolbar');

    // Check modal visibility after creation
    setTimeout(() => handleButtonVisibility(), 100);
  }

  /**
   * Handle messages from the main injected script
   */
  function handleMainScriptMessage(data) {
    switch (data.action) {
      case 'panelClosed':
        if (patplacerButton) {
          patplacerButton.style.background = '';
        }
        break;
      case 'panelOpened':
        if (patplacerButton) {
          patplacerButton.style.background = '#667eea';
        }
        break;
    }
  }

  // Listen for messages from injected script
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'patplacer-main') {
      handleMainScriptMessage(event.data);
    }
  });

  // Setup modal observers - same approach as WPlace-AutoBot
  function setupModalObservers() {
    const modalAttributeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
          handleButtonVisibility();
        }
      });
    });

    const domObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && node.matches('dialog.modal, dialog')) {
                modalAttributeObserver.observe(node, {
                  attributes: true,
                  attributeFilter: ['open']
                });
                handleButtonVisibility();
              }

              const nestedModals = node.querySelectorAll ?
                node.querySelectorAll('dialog.modal, dialog') : [];
              nestedModals.forEach((modal) => {
                modalAttributeObserver.observe(modal, {
                  attributes: true,
                  attributeFilter: ['open']
                });
              });

              if (nestedModals.length > 0) {
                handleButtonVisibility();
              }
            }
          });

          if (mutation.removedNodes.length > 0) {
            handleButtonVisibility();
          }
        }
      });
    });

    const existingModals = document.querySelectorAll('dialog.modal, dialog');
    existingModals.forEach((modal) => {
      modalAttributeObserver.observe(modal, {
        attributes: true,
        attributeFilter: ['open']
      });
    });

    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Observer to recreate button if removed by wplace's code
  const buttonObserver = new MutationObserver((mutations) => {
    if (!buttonRemoved) {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          if (!document.getElementById(BUTTON_ID)) {
            // Reset the hidden flag since we're creating a new button
            buttonHiddenByModal = false;
            setTimeout(createPatPlacerButton, 500);
          }
        }
      });
    }
  });

  // Initialize - create button when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createPatPlacerButton();
      setupModalObservers();
    });
  } else {
    createPatPlacerButton();
    setupModalObservers();
  }

  // Delayed retry - same as WPlace-AutoBot
  setTimeout(() => {
    createPatPlacerButton();
    setupModalObservers();
  }, 2000);

  // Start button recreation observer
  buttonObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('[PatPlacer] Content script loaded');

}
