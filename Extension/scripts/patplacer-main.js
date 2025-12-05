/**
 * PatPlacer - Main Script
 * Runs in page MAIN world context
 * Handles: UI panel, image upload, image processing, draft capture, template overlay, draft placement
 *  
 * WORKFLOW: Upload Image → Process (resize, dither, color match) → Apply → Set Anchor → Place Drafts
 */

(function() {
  'use strict';

  // Prevent double initialization
  if (window.PatPlacer) {
    console.log('[PatPlacer] Already initialized, toggling panel');
    window.PatPlacer.togglePanel();
    return;
  }

  console.log('[PatPlacer] Initializing...');

  // ============================================================
  // CONFIGURATION
  // ============================================================
  const CONFIG = {
    TILE_SIZE: 1000,
    DEFAULT_OPACITY: 1.0,
    PANEL_ID: 'patplacer-panel',
    // WPlace color palette (will be extracted from page)
    COLOR_PALETTE: [],
    // Icon base URL (set during panel creation)
    ICON_BASE: (window.__PATPLACER_RESOURCES__ && window.__PATPLACER_RESOURCES__.iconsBaseUrl)
      ? window.__PATPLACER_RESOURCES__.iconsBaseUrl
      : 'icons/'
  };
  
  // ============================================================
  // DEBOUNCE HELPER
  // ============================================================
  let previewDebounceTimer = null;
  function debouncePreview() {
    if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
      updateProcessingPreview();
    }, 300);
  }
  
  // ============================================================
  // IMAGE PROCESSOR INSTANCE
  // ============================================================
  let imageProcessor = null;
  
  // Processing settings state
  const processingSettings = {
    // Resize
    width: 100,
    height: 100,
    lockAspect: true,
    resamplingMethod: 'nearest',
    
    // Color Matching
    colorMatchingMethod: 'lab',
    
    // Dithering
    ditheringEnabled: false,
    ditheringMethod: 'floyd-steinberg',
    ditheringStrength: 0.5,
    
    // Pre-processing
    blur: 0,
    blurMode: 'none',
    sharpen: 0,
    
    // Color Correction
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    gamma: 100,

    // Edge Detection
    edgeAlgorithm: 'sobel',
    edgeThreshold: 60,
    edgeThickness: 0,
    edgeThin: false,

    // Transparency
    paintTransparent: false,
    paintWhite: true,
    transparencyThreshold: 128,
    whiteThreshold: 230,

    // Post-Processing
    posterize: 32,
    modeFilter: 0,
    simplify: 0,
    erode: 0
  };

  // Reset processing settings to defaults
  function resetProcessingSettings(imgWidth, imgHeight) {
    processingSettings.width = imgWidth || 100;
    processingSettings.height = imgHeight || 100;
    processingSettings.lockAspect = true;
    processingSettings.resamplingMethod = 'nearest';
    processingSettings.colorMatchingMethod = 'lab';
    processingSettings.ditheringEnabled = false;
    processingSettings.ditheringMethod = 'floyd-steinberg';
    processingSettings.ditheringStrength = 0.5;
    processingSettings.blur = 0;
    processingSettings.blurMode = 'none';
    processingSettings.sharpen = 0;
    processingSettings.brightness = 0;
    processingSettings.contrast = 0;
    processingSettings.saturation = 0;
    processingSettings.hue = 0;
    processingSettings.gamma = 100;
    processingSettings.edgeAlgorithm = 'sobel';
    processingSettings.edgeThreshold = 60;
    processingSettings.edgeThickness = 0;
    processingSettings.edgeThin = false;
    processingSettings.paintTransparent = false;
    processingSettings.paintWhite = true;
    processingSettings.transparencyThreshold = 128;
    processingSettings.whiteThreshold = 230;
    processingSettings.posterize = 32;
    processingSettings.modeFilter = 0;
    processingSettings.simplify = 0;
    processingSettings.erode = 0;
    
    // Update UI if panel exists
    updateProcessingPanelUI();
  }

  // Update processing panel UI to reflect current settings
  function updateProcessingPanelUI() {
    const panel = document.getElementById('patplacer-processing-panel');
    if (!panel) return;

    // Resize
    const widthInput = panel.querySelector('#pp-resize-width');
    const heightInput = panel.querySelector('#pp-resize-height');
    const lockAspect = panel.querySelector('#pp-lock-aspect');
    const resamplingSelect = panel.querySelector('#pp-resampling');
    if (widthInput) widthInput.value = processingSettings.width;
    if (heightInput) heightInput.value = processingSettings.height;
    if (lockAspect) lockAspect.checked = processingSettings.lockAspect;
    if (resamplingSelect) resamplingSelect.value = processingSettings.resamplingMethod;

    // Color Matching
    const colorMatchSelect = panel.querySelector('#pp-color-match');
    if (colorMatchSelect) colorMatchSelect.value = processingSettings.colorMatchingMethod;

    // Dithering
    const ditherToggle = panel.querySelector('#pp-dither-toggle');
    const ditherMethod = panel.querySelector('#pp-dither-method');
    const ditherStrength = panel.querySelector('#pp-dither-strength');
    const ditherMethodControl = panel.querySelector('#pp-dither-method-control');
    const ditherStrengthControl = panel.querySelector('#pp-dither-strength-control');
    if (ditherToggle) ditherToggle.checked = processingSettings.ditheringEnabled;
    if (ditherMethod) ditherMethod.value = processingSettings.ditheringMethod;
    if (ditherStrength) {
      ditherStrength.value = processingSettings.ditheringStrength * 100;
      const label = panel.querySelector('[data-for="pp-dither-strength"]');
      if (label) label.textContent = processingSettings.ditheringStrength.toFixed(2);
    }
    if (ditherMethodControl) ditherMethodControl.style.display = processingSettings.ditheringEnabled ? 'block' : 'none';
    if (ditherStrengthControl) ditherStrengthControl.style.display = processingSettings.ditheringEnabled ? 'block' : 'none';

    // Pre-processing
    const blurMode = panel.querySelector('#pp-blur-mode');
    const blurRadius = panel.querySelector('#pp-blur-radius');
    const blurRadiusControl = panel.querySelector('#pp-blur-radius-control');
    const sharpen = panel.querySelector('#pp-sharpen');
    if (blurMode) {
      blurMode.value = processingSettings.blurMode || 'none';
    }
    if (blurRadiusControl) {
      blurRadiusControl.style.display = (processingSettings.blurMode && processingSettings.blurMode !== 'none') ? 'block' : 'none';
    }
    if (blurRadius) {
      blurRadius.value = processingSettings.blur;
      const label = panel.querySelector('[data-for="pp-blur-radius"]');
      if (label) label.textContent = processingSettings.blur;
    }
    if (sharpen) {
      sharpen.value = processingSettings.sharpen;
      const label = panel.querySelector('[data-for="pp-sharpen"]');
      if (label) label.textContent = processingSettings.sharpen;
    }

    // Color Correction
    const brightness = panel.querySelector('#pp-brightness');
    const contrast = panel.querySelector('#pp-contrast');
    const saturation = panel.querySelector('#pp-saturation');
    const hue = panel.querySelector('#pp-hue');
    const gamma = panel.querySelector('#pp-gamma');
    if (brightness) {
      brightness.value = processingSettings.brightness;
      const label = panel.querySelector('[data-for="pp-brightness"]');
      if (label) label.textContent = processingSettings.brightness;
    }
    if (contrast) {
      contrast.value = processingSettings.contrast;
      const label = panel.querySelector('[data-for="pp-contrast"]');
      if (label) label.textContent = processingSettings.contrast;
    }
    if (saturation) {
      saturation.value = processingSettings.saturation;
      const label = panel.querySelector('[data-for="pp-saturation"]');
      if (label) label.textContent = processingSettings.saturation;
    }
    if (hue) {
      hue.value = processingSettings.hue;
      const label = panel.querySelector('[data-for="pp-hue"]');
      if (label) label.textContent = processingSettings.hue;
    }
    if (gamma) {
      gamma.value = processingSettings.gamma;
      const label = panel.querySelector('[data-for="pp-gamma"]');
      if (label) label.textContent = (processingSettings.gamma / 100).toFixed(2);
    }

    // Edge Detection
    const edgeEnable = panel.querySelector('#pp-edge-enable');
    const edgeControls = panel.querySelector('#pp-edge-controls');
    const edgeAlgo = panel.querySelector('#pp-edge-algorithm');
    const edgeThreshold = panel.querySelector('#pp-edge-threshold');
    const edgeThickness = panel.querySelector('#pp-edge-thickness');
    const edgeThin = panel.querySelector('#pp-edge-thin');
    
    if (edgeEnable) edgeEnable.checked = processingSettings.edgeThickness > 0;
    if (edgeControls) edgeControls.style.display = processingSettings.edgeThickness > 0 ? 'block' : 'none';
    if (edgeAlgo) edgeAlgo.value = processingSettings.edgeAlgorithm;
    if (edgeThreshold) {
      edgeThreshold.value = processingSettings.edgeThreshold;
      const label = panel.querySelector('[data-for="pp-edge-threshold"]');
      if (label) label.textContent = processingSettings.edgeThreshold;
    }
    if (edgeThickness) {
      edgeThickness.value = processingSettings.edgeThickness;
      const label = panel.querySelector('[data-for="pp-edge-thickness"]');
      if (label) label.textContent = processingSettings.edgeThickness;
    }
    if (edgeThin) edgeThin.checked = processingSettings.edgeThin;

    // Transparency
    const paintTransparent = panel.querySelector('#pp-paint-transparent');
    const transThreshold = panel.querySelector('#pp-transparency-threshold');
    if (paintTransparent) paintTransparent.checked = processingSettings.paintTransparent;
    if (transThreshold) {
      transThreshold.value = processingSettings.transparencyThreshold;
      const label = panel.querySelector('[data-for="pp-transparency-threshold"]');
      if (label) label.textContent = processingSettings.transparencyThreshold;
    }

    // Post-Processing
    const posterize = panel.querySelector('#pp-posterize');
    const modeFilter = panel.querySelector('#pp-mode-filter');
    const simplify = panel.querySelector('#pp-simplify');
    const erode = panel.querySelector('#pp-erode');
    if (posterize) {
      posterize.value = processingSettings.posterize;
      const label = panel.querySelector('[data-for="pp-posterize"]');
      if (label) label.textContent = processingSettings.posterize;
    }
    if (modeFilter) {
      modeFilter.value = processingSettings.modeFilter;
      const label = panel.querySelector('[data-for="pp-mode-filter"]');
      if (label) label.textContent = processingSettings.modeFilter;
    }
    if (simplify) {
      simplify.value = processingSettings.simplify;
      const label = panel.querySelector('[data-for="pp-simplify"]');
      if (label) label.textContent = processingSettings.simplify;
    }
    if (erode) {
      erode.value = processingSettings.erode;
      const label = panel.querySelector('[data-for="pp-erode"]');
      if (label) label.textContent = processingSettings.erode;
    }
  }

  // ============================================================
  // STATE
  // ============================================================
  const state = {
    panelVisible: false,
    
    // Original image (before processing)
    originalImageLoaded: false,
    originalBitmap: null,
    originalWidth: 0,
    originalHeight: 0,
    
    // Processed image (after applying processing)
    imageLoaded: false,
    imageBitmap: null,
    imageData: null,
    imageWidth: 0,
    imageHeight: 0,
    
    // Workflow stage: 'upload' | 'process' | 'ready'
    workflowStage: 'upload',
    
    // Anchor point (from first draft)
    anchorSet: false,
    anchorTile: null,    // {x, y} - tile coordinates
    anchorPixel: null,   // {x, y} - pixel within tile
    
    // Saved anchor - original position from save file (for arrow guide)
    savedAnchor: null,   // {tile: {x,y}, pixel: {x,y}} - original anchor from loaded save
    
    // Overlay - Template overlay (shows full image before drafts)
    templateOverlayEnabled: false,
    templateOverlayOpacity: CONFIG.DEFAULT_OPACITY,
    
    // Overlay - Draft overlay (shows placed drafts after placement)
    draftOverlayEnabled: false,
    draftOverlayOpacity: CONFIG.DEFAULT_OPACITY,
    
    // Shared overlay settings
    chunkedTiles: new Map(),
    overlayMode: 'template', // 'template' or 'draft'
    
    // Draft placement - BATCH SYSTEM
    allPixels: [],           // All pixels from template
    placedPixels: [],        // Pixels placed in current batch (for overlay)
    currentBatchIndex: 0,    // How many pixels already confirmed total
    pendingBatchCount: 0,    // Pixels in current batch awaiting confirmation
    pendingSkippedCount: 0,  // Skipped pixels in current batch (for progress display)
    isPlacing: false,
    
    // Charges
    currentCharges: 0,
    maxCharges: 0,
    
    // Color Palette
    colorsCaptured: false,   // Whether user's available colors have been captured
    availableColors: [],     // Array of available colors from wplace palette
    
    // Options (hardcoded)
    skipWhite: false,        // Never skip white pixels
    skipTransparent: true,   // Always skip transparent pixels
    
    // Draft listener
    draftListenerActive: false,
    originalMapSet: null,
    pixelDraftMap: null,  // Reference to wplace's pixel draft Map
    
    // Original tile data cache for skip-correct-pixels feature
    // Key: "tileX,tileY", Value: ImageData object
    originalTilesData: new Map()
  };

  // ============================================================
  // COLOR PALETTE EXTRACTION
  // ============================================================
  
  // Try to find wplace's internal palette store
  function findWplacePalette() {
    try {
      // Look for palette in global scope or common variable names
      const candidates = ['palette', 'colors', 'colorPalette', 'COLORS', 'PALETTE'];
      for (const name of candidates) {
        if (window[name] && Array.isArray(window[name]) && window[name].length >= 16) {
          console.log(`[PatPlacer] Found palette in window.${name}`);
          return window[name];
        }
      }
      
      // Try to find it in Svelte stores or state
      // wplace uses SvelteKit, so data might be in __sveltekit_*
      for (const key of Object.keys(window)) {
        if (key.includes('svelte') || key.includes('store')) {
          const val = window[key];
          if (val && typeof val === 'object') {
            // Look for palette-like arrays
            for (const prop of Object.keys(val)) {
              const arr = val[prop];
              if (Array.isArray(arr) && arr.length >= 16 && arr.length <= 64) {
                // Check if it looks like a color array
                if (typeof arr[0] === 'string' && arr[0].startsWith('#')) {
                  console.log(`[PatPlacer] Found palette in ${key}.${prop}`);
                  return arr;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[PatPlacer] Error searching for palette:', e);
    }
    return null;
  }
  
  /**
   * Initialize image processor with retry logic
   * Sometimes the processor script hasn't fully loaded yet
   */
  async function initImageProcessor() {
    const maxRetries = 10;
    const retryDelay = 50; // ms
    
    for (let i = 0; i < maxRetries; i++) {
      if (window.PatPlacerImageProcessor) {
        imageProcessor = new window.PatPlacerImageProcessor();
        console.log('[PatPlacer] Image processor initialized');
        return true;
      }
      await new Promise(r => setTimeout(r, retryDelay));
    }
    
    console.warn('[PatPlacer] Image processor not loaded after retries - processing features unavailable');
    return false;
  }
  
  function extractColorPalette() {
    let colors = [];
    
    // FIRST: Try to find wplace's internal palette
    const wplacePalette = findWplacePalette();
    if (wplacePalette) {
      wplacePalette.forEach((item, idx) => {
        let hex, r, g, b;
        if (typeof item === 'string') {
          hex = item;
          const rgb = hexToRgb(item);
          r = rgb.r; g = rgb.g; b = rgb.b;
        } else if (item && item.hex) {
          hex = item.hex;
          r = item.r; g = item.g; b = item.b;
        }
        if (hex) {
          colors.push({ id: idx, r, g, b, hex });
        }
      });
      if (colors.length >= 16) {
        CONFIG.COLOR_PALETTE = colors;
        console.log(`[PatPlacer] Using wplace internal palette: ${colors.length} colors`);
        return colors;
      }
    }
    
    // SECOND: Try to extract from DOM
    try {
      // Look for the actual color picker buttons in wplace
      // They usually have specific classes or data attributes
      const colorPicker = document.querySelector('[class*="color"], [class*="palette"], [class*="picker"]');
      if (colorPicker) {
        const buttons = colorPicker.querySelectorAll('button, [role="button"], div[style*="background"]');
        buttons.forEach((btn, idx) => {
          const style = window.getComputedStyle(btn);
          const bgColor = style.backgroundColor;
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            const rgb = bgColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
              const r = parseInt(rgb[0]);
              const g = parseInt(rgb[1]);
              const b = parseInt(rgb[2]);
              colors.push({
                id: idx,
                r, g, b,
                hex: rgbToHex(r, g, b)
              });
            }
          }
        });
      }
    } catch (e) {
      console.warn('[PatPlacer] Error extracting palette from DOM:', e);
    }

    // THIRD: Use hardcoded fallback if all else fails
    if (colors.length < 16) {
      console.log('[PatPlacer] Using default fallback palette');
      colors = [];
      
      // WPLACE OFFICIAL COLOR MAP - from Wplace-AutoBot
      // The 'id' is the colorIdx sent to the server
      const WPLACE_COLOR_MAP = [
        { id: 1, name: 'Black', r: 0, g: 0, b: 0 },
        { id: 2, name: 'Dark Gray', r: 60, g: 60, b: 60 },
        { id: 3, name: 'Gray', r: 120, g: 120, b: 120 },
        { id: 4, name: 'Light Gray', r: 210, g: 210, b: 210 },
        { id: 5, name: 'White', r: 255, g: 255, b: 255 },
        { id: 6, name: 'Deep Red', r: 96, g: 0, b: 24 },
        { id: 7, name: 'Red', r: 237, g: 28, b: 36 },
        { id: 8, name: 'Orange', r: 255, g: 127, b: 39 },
        { id: 9, name: 'Gold', r: 246, g: 170, b: 9 },
        { id: 10, name: 'Yellow', r: 249, g: 221, b: 59 },
        { id: 11, name: 'Light Yellow', r: 255, g: 250, b: 188 },
        { id: 12, name: 'Dark Green', r: 14, g: 185, b: 104 },
        { id: 13, name: 'Green', r: 19, g: 230, b: 123 },
        { id: 14, name: 'Light Green', r: 135, g: 255, b: 94 },
        { id: 15, name: 'Dark Teal', r: 12, g: 129, b: 110 },
        { id: 16, name: 'Teal', r: 16, g: 174, b: 166 },
        { id: 17, name: 'Light Teal', r: 19, g: 225, b: 190 },
        { id: 18, name: 'Dark Blue', r: 40, g: 80, b: 158 },
        { id: 19, name: 'Blue', r: 64, g: 147, b: 228 },
        { id: 20, name: 'Cyan', r: 96, g: 247, b: 242 },
        { id: 21, name: 'Indigo', r: 107, g: 80, b: 246 },
        { id: 22, name: 'Light Indigo', r: 153, g: 177, b: 251 },
        { id: 23, name: 'Dark Purple', r: 120, g: 12, b: 153 },
        { id: 24, name: 'Purple', r: 170, g: 56, b: 185 },
        { id: 25, name: 'Light Purple', r: 224, g: 159, b: 249 },
        { id: 26, name: 'Dark Pink', r: 203, g: 0, b: 122 },
        { id: 27, name: 'Pink', r: 236, g: 31, b: 128 },
        { id: 28, name: 'Light Pink', r: 243, g: 141, b: 169 },
        { id: 29, name: 'Dark Brown', r: 104, g: 70, b: 52 },
        { id: 30, name: 'Brown', r: 149, g: 104, b: 42 },
        { id: 31, name: 'Beige', r: 248, g: 178, b: 119 },
        { id: 32, name: 'Medium Gray', r: 170, g: 170, b: 170 },
        { id: 33, name: 'Dark Red', r: 165, g: 14, b: 30 },
        { id: 34, name: 'Light Red', r: 250, g: 128, b: 114 },
        { id: 35, name: 'Dark Orange', r: 228, g: 92, b: 26 },
        { id: 36, name: 'Light Tan', r: 214, g: 181, b: 148 },
        { id: 37, name: 'Dark Goldenrod', r: 156, g: 132, b: 49 },
        { id: 38, name: 'Goldenrod', r: 197, g: 173, b: 49 },
        { id: 39, name: 'Light Goldenrod', r: 232, g: 212, b: 95 },
        { id: 40, name: 'Dark Olive', r: 74, g: 107, b: 58 },
        { id: 41, name: 'Olive', r: 90, g: 148, b: 74 },
        { id: 42, name: 'Light Olive', r: 132, g: 197, b: 115 },
        { id: 43, name: 'Dark Cyan', r: 15, g: 121, b: 159 },
        { id: 44, name: 'Light Cyan', r: 187, g: 250, b: 242 },
        { id: 45, name: 'Light Blue', r: 125, g: 199, b: 255 },
        { id: 46, name: 'Dark Indigo', r: 77, g: 49, b: 184 },
        { id: 47, name: 'Dark Slate Blue', r: 74, g: 66, b: 132 },
        { id: 48, name: 'Slate Blue', r: 122, g: 113, b: 196 },
        { id: 49, name: 'Light Slate Blue', r: 181, g: 174, b: 241 },
        { id: 50, name: 'Light Brown', r: 219, g: 164, b: 99 },
        { id: 51, name: 'Dark Beige', r: 209, g: 128, b: 81 },
        { id: 52, name: 'Light Beige', r: 255, g: 197, b: 165 },
        { id: 53, name: 'Dark Peach', r: 155, g: 82, b: 73 },
        { id: 54, name: 'Peach', r: 209, g: 128, b: 120 },
        { id: 55, name: 'Light Peach', r: 250, g: 182, b: 164 },
        { id: 56, name: 'Dark Tan', r: 123, g: 99, b: 82 },
        { id: 57, name: 'Tan', r: 156, g: 132, b: 107 },
        { id: 58, name: 'Dark Slate', r: 51, g: 57, b: 65 },
        { id: 59, name: 'Slate', r: 109, g: 117, b: 141 },
        { id: 60, name: 'Light Slate', r: 179, g: 185, b: 209 },
        { id: 61, name: 'Dark Stone', r: 109, g: 100, b: 63 },
        { id: 62, name: 'Stone', r: 148, g: 140, b: 107 },
        { id: 63, name: 'Light Stone', r: 205, g: 197, b: 158 },
      ];
      
      WPLACE_COLOR_MAP.forEach(c => {
        colors.push({
          id: c.id,
          r: c.r,
          g: c.g,
          b: c.b,
          hex: rgbToHex(c.r, c.g, c.b),
          name: c.name
        });
      });
      
      console.log('[PatPlacer] Using official wplace palette with', colors.length, 'colors');
    }

    CONFIG.COLOR_PALETTE = colors;
    console.log(`[PatPlacer] Extracted ${colors.length} colors`);
    return colors;
  }

  // ============================================================
  // AVAILABLE COLORS EXTRACTION (from wplace palette dialog)
  // ============================================================
  function extractAvailableColors() {
    // Look for wplace color palette buttons
    // They appear in a tooltip/dialog when user clicks the paint button
    const colorElements = document.querySelectorAll('.tooltip button[id^="color-"]');
    
    if (colorElements.length === 0) {
      console.log('[PatPlacer] No color elements found in palette');
      return null;
    }
    
    const availableColors = [];
    const unavailableColors = [];
    
    Array.from(colorElements).forEach((el) => {
      const id = parseInt(el.id.replace('color-', ''), 10);
      if (id === 0) return; // Skip transparent color
      
      const rgbStr = el.style.backgroundColor.match(/\d+/g);
      if (!rgbStr || rgbStr.length < 3) return;
      
      const r = parseInt(rgbStr[0]);
      const g = parseInt(rgbStr[1]);
      const b = parseInt(rgbStr[2]);
      
      const colorData = {
        id,
        r, g, b,
        hex: rgbToHex(r, g, b),
        rgb: [r, g, b]
      };
      
      // Check if color is available (no SVG overlay means available)
      if (!el.querySelector('svg')) {
        availableColors.push(colorData);
      } else {
        unavailableColors.push(colorData);
      }
    });
    
    console.log(`[PatPlacer] Captured colors: ${availableColors.length} available, ${unavailableColors.length} locked`);
    
    return availableColors.length > 0 ? availableColors : null;
  }
  
  function onColorsCaptured(colors) {
    state.availableColors = colors;
    state.colorsCaptured = true;
    
    // Update CONFIG.COLOR_PALETTE to only include available colors
    CONFIG.COLOR_PALETTE = colors.map(c => ({
      id: c.id,
      r: c.r,
      g: c.g,
      b: c.b,
      hex: c.hex
    }));
    
    // Update info panel palette status
    const paletteText = document.getElementById('patplacer-palette-text');
    if (paletteText) {
      paletteText.textContent = `${colors.length} COLORS`;
      paletteText.classList.remove('pp-pulse');
      paletteText.classList.add('pp-captured');
    }
    
    // Display color swatches in the info panel
    const swatchContainer = document.getElementById('patplacer-color-swatches');
    if (swatchContainer) {
      swatchContainer.innerHTML = '';
      colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'pp-color-swatch';
        swatch.style.backgroundColor = color.hex;
        swatch.title = `#${color.hex.replace('#', '').toUpperCase()}`;
        swatchContainer.appendChild(swatch);
      });
    }
    
    updateStatus(`✓ Captured ${colors.length} available colors`);
    console.log('[PatPlacer] Colors captured successfully:', colors.length);
  }
  
  function setupColorPaletteObserver() {
    // Watch for tooltip/dialog appearing with color buttons
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          
          // Check if this is a tooltip or contains color buttons
          const colorButtons = node.querySelectorAll ? 
            node.querySelectorAll('button[id^="color-"]') : [];
          
          if (colorButtons.length > 0) {
            console.log('[PatPlacer] Color palette detected!');
            // Small delay to ensure all colors are rendered
            setTimeout(() => {
              const colors = extractAvailableColors();
              if (colors && colors.length > 0) {
                onColorsCaptured(colors);
              }
            }, 100);
          }
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[PatPlacer] Color palette observer active');
    return observer;
  }

  // ============================================================
  // COLOR UTILITIES
  // ============================================================
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function colorDistance(r1, g1, b1, r2, g2, b2) {
    // Simple Euclidean distance
    return Math.sqrt(
      Math.pow(r1 - r2, 2) +
      Math.pow(g1 - g2, 2) +
      Math.pow(b1 - b2, 2)
    );
  }

  function findClosestColor(r, g, b) {
    let closest = null;
    let minDistance = Infinity;

    for (const color of CONFIG.COLOR_PALETTE) {
      const dist = colorDistance(r, g, b, color.r, color.g, color.b);
      if (dist < minDistance) {
        minDistance = dist;
        closest = color;
      }
    }

    return closest;
  }

  function isWhitePixel(r, g, b) {
    return r > 250 && g > 250 && b > 250;
  }

  function isTransparentPixel(a) {
    return a < 128;
  }

  /**
   * Get the color of a pixel on the canvas from cached tile data
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {number} pixelX - Pixel X within tile (0-63)
   * @param {number} pixelY - Pixel Y within tile (0-63)
   * @returns {[number, number, number, number] | null} - [r, g, b, a] or null if tile not cached
   */
  function getTilePixelColor(tileX, tileY, pixelX, pixelY) {
    const tileKey = `${tileX},${tileY}`;
    const imageData = state.originalTilesData.get(tileKey);
    
    if (!imageData) {
      return null; // Tile not cached
    }
    
    // Calculate pixel index in ImageData
    const idx = (pixelY * imageData.width + pixelX) * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    const a = imageData.data[idx + 3];
    
    return [r, g, b, a];
  }
  
  /**
   * Map RGB color to wplace palette ID
   * Uses exact match first, then falls back to closest color
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {number | null} - Palette ID (1-63) or null if not found
   */
  function resolveColorToId(r, g, b) {
    // First try exact match (faster)
    for (const color of CONFIG.COLOR_PALETTE) {
      if (color.r === r && color.g === g && color.b === b) {
        return color.id;
      }
    }
    
    // Fall back to closest color
    const closest = findClosestColor(r, g, b);
    return closest ? closest.id : null;
  }
  
  /**
   * Check if a pixel at the given position already has the correct color on the canvas
   * @param {Object} pixel - Pixel object with x, y, colorIdx
   * @returns {boolean} - true if pixel should be skipped (already correct)
   */
  function isPixelAlreadyCorrect(pixel) {
    // Calculate absolute position
    const absPixelX = state.anchorPixel.x + pixel.x;
    const absPixelY = state.anchorPixel.y + pixel.y;

    // Calculate tile and pixel within tile
    const tileOffsetX = Math.floor(absPixelX / CONFIG.TILE_SIZE);
    const tileOffsetY = Math.floor(absPixelY / CONFIG.TILE_SIZE);
    
    const tileX = state.anchorTile.x + tileOffsetX;
    const tileY = state.anchorTile.y + tileOffsetY;
    
    const pixelInTileX = ((absPixelX % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;
    const pixelInTileY = ((absPixelY % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;
    
    // Get canvas color at this position
    const canvasColor = getTilePixelColor(tileX, tileY, pixelInTileX, pixelInTileY);
    
    if (!canvasColor) {
      // Tile not cached yet - can't determine, place the pixel to be safe
      return false;
    }
    
    const [r, g, b, a] = canvasColor;
    
    // If canvas pixel is transparent, it's not correct (we want to place a color)
    if (a < 128) {
      return false;
    }
    
    // Resolve canvas color to palette ID
    const canvasColorId = resolveColorToId(r, g, b);
    
    // Compare with target color ID
    return canvasColorId === pixel.colorIdx;
  }

  // ============================================================
  // STORAGE & EXPORT
  // ============================================================
  const PatPlacerStorage = {
    // Serialize current state to Hybrid JSON format
    serializeState(name = 'My Pixel Art') {
      // Create palette from used colors to save space
      const palette = [];
      const paletteMap = new Map(); // "r,g,b,a" -> index
      
      // Helper to get/add color to palette
      const getPaletteIdx = (r, g, b, a = 255) => {
        const key = `${r},${g},${b},${a}`;
        if (paletteMap.has(key)) return paletteMap.get(key);
        const idx = palette.length;
        palette.push([r, g, b, a]);
        paletteMap.set(key, idx);
        return idx;
      };

      // Convert pixels to compact format: [x, y, paletteIdx, wplaceColorIdx]
      // We use relative coordinates (x,y) because they are the source of truth.
      // Absolute tile/pixel coordinates are derived from anchor + x,y.
      const compactPixels = state.allPixels.map(p => {
        // Ensure we have x,y
        if (typeof p.x !== 'number' || typeof p.y !== 'number') {
          return [0, 0, 0, 0]; 
        }
        
        // Handle both flat structure (from buildPixelList) and nested color object (legacy/safety)
        let r, g, b;
        if (p.color) {
          r = p.color.r; g = p.color.g; b = p.color.b;
        } else {
          r = p.r; g = p.g; b = p.b;
        }

        return [
          p.x, p.y, 
          getPaletteIdx(r, g, b), 
          p.colorIdx
        ];
      });

      return {
        version: 2, // Bump version for new format
        savedAt: Date.now(),
        project: {
          name: name,
          anchor: state.anchorSet ? {
            tile: state.anchorTile,
            pixel: state.anchorPixel
          } : null
        },
        palette: palette,
        pixels: compactPixels,
        progress: {
          placedCount: state.currentBatchIndex
        }
      };
    },

    // Deserialize Hybrid JSON to state
    async deserializeState(data) {
      if (!data || !data.pixels) {
        throw new Error('Invalid save file format');
      }

      // Restore anchor if present - also store as savedAnchor for arrow guide
      if (data.project && data.project.anchor) {
        // Store the original anchor position for the arrow guide
        state.savedAnchor = {
          tile: { ...data.project.anchor.tile },
          pixel: { ...data.project.anchor.pixel }
        };
        
        // Don't auto-restore anchor - let user re-capture it
        // But show UI that we have a saved anchor position
        state.anchorSet = false;
        state.anchorTile = null;
        state.anchorPixel = null;
        
        const tileEl = document.getElementById('patplacer-tile-pos');
        const pixelEl = document.getElementById('patplacer-pixel-pos');
        if (tileEl) tileEl.textContent = '(not set)';
        if (pixelEl) pixelEl.textContent = '(not set)';
        
        const capBtn = document.getElementById('patplacer-capture-btn');
        if (capBtn) capBtn.innerHTML = `<img src="${CONFIG.ICON_BASE}location.png" class="pp-btn-icon" alt=""> Capture Anchor`;
        
        // Show the arrow guide to saved anchor position
        showSavedAnchorArrow();
      } else {
        state.savedAnchor = null;
      }

      // Restore pixels
      state.allPixels = data.pixels.map(p => {
        // Handle both formats (v1: 6 args, v2: 4 args)
        let x, y, palIdx, colorIdx;
        
        if (p.length === 6) {
          // v1: [tx, ty, px, py, palIdx, colorIdx] - Absolute
          // We need to convert back to relative x,y if possible
          // But since we might not have anchor, this is tricky.
          // For now, let's assume we can't easily recover x,y without complex math
          // So we'll just use 0,0 and hope the user re-uploads image? 
          // Or better: if we have anchor, calculate x,y.
          // But simpler: just support v2 for now since v1 was never released/working fully.
          palIdx = p[4];
          colorIdx = p[5];
          x = 0; y = 0; // Fallback
        } else {
          // v2: [x, y, palIdx, colorIdx] - Relative
          [x, y, palIdx, colorIdx] = p;
        }

        const rgba = data.palette[palIdx] || [0,0,0,255];
        return {
          x: x,
          y: y,
          // Use flat structure to match buildPixelList and placeDraft expectations
          r: rgba[0], 
          g: rgba[1], 
          b: rgba[2],
          // color: { ... } - Removed to ensure consistency with flat structure
          colorIdx: colorIdx,
          season: 0
        };
      });

      // Restore progress
      state.currentBatchIndex = data.progress?.placedCount || 0;
      
      // Re-calculate placed pixels for overlay
      state.placedPixels = state.allPixels.slice(0, state.currentBatchIndex);
      
      // Update UI
      const totalEl = document.getElementById('patplacer-total-pixels');
      if (totalEl) totalEl.textContent = state.allPixels.length;
      
      const sizeEl = document.getElementById('patplacer-image-size');
      if (sizeEl) sizeEl.textContent = 'Loaded from save';
      
      const countEl = document.getElementById('patplacer-pixel-count');
      if (countEl) countEl.textContent = `${state.allPixels.length} pixels`;
      
      const infoEl = document.getElementById('patplacer-image-info');
      if (infoEl) infoEl.style.display = 'block';
      
      updateBatchUI();
      
      // Update status with anchor guidance if we have a saved anchor
      if (state.savedAnchor) {
        const { tile, pixel } = state.savedAnchor;
        updateStatus(`Loaded "${data.project.name}" - Place anchor at tile (${tile.x}, ${tile.y}), pixel (${pixel.x}, ${pixel.y})`);
      } else {
        updateStatus(`Loaded project "${data.project.name}" with ${state.allPixels.length} pixels`);
      }
      
      // Reconstruct preview and imageBitmap from loaded pixels (async)
      if (state.allPixels.length > 0) {
        await this.reconstructPreview();
      }
      
      // Note: We don't auto-enable overlay since anchor is not set yet
      // User needs to capture anchor first
    },
    
    // Reconstruct preview image from loaded pixels
    async reconstructPreview() {
      if (state.allPixels.length === 0) return;
      
      // Find dimensions from pixel coordinates
      let maxX = 0, maxY = 0;
      for (const p of state.allPixels) {
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const width = maxX + 1;
      const height = maxY + 1;
      
      // Create canvas with reconstructed image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      // Fill with transparent
      ctx.clearRect(0, 0, width, height);
      
      // Draw each pixel
      const imageData = ctx.createImageData(width, height);
      for (const p of state.allPixels) {
        const idx = (p.y * width + p.x) * 4;
        imageData.data[idx] = p.r;
        imageData.data[idx + 1] = p.g;
        imageData.data[idx + 2] = p.b;
        imageData.data[idx + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
      
      // IMPORTANT: Create imageBitmap for template overlay functionality
      try {
        state.imageBitmap = await createImageBitmap(canvas);
        state.imageLoaded = true;
        console.log(`[PatPlacer] Reconstructed imageBitmap: ${width}x${height}`);
      } catch (e) {
        console.warn('[PatPlacer] Failed to create imageBitmap from reconstructed image:', e);
      }
      
      // Update preview canvas in info panel
      const previewCanvas = document.getElementById('patplacer-preview-canvas');
      if (previewCanvas) {
        previewCanvas.width = width;
        previewCanvas.height = height;
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.imageSmoothingEnabled = false;
        previewCtx.drawImage(canvas, 0, 0);
        previewCanvas.style.display = 'block';
      }
      
      // Hide "no image" placeholder
      const noImageEl = document.getElementById('patplacer-no-image');
      if (noImageEl) noImageEl.style.display = 'none';
      
      // Update info panel stats
      const sizeEl = document.getElementById('patplacer-stat-size');
      const pixelsEl = document.getElementById('patplacer-stat-pixels');
      const colorsEl = document.getElementById('patplacer-stat-colors');
      const statusBadge = document.getElementById('patplacer-image-status');
      
      // Count unique colors
      const colorSet = new Set();
      for (const p of state.allPixels) {
        colorSet.add(`${p.r},${p.g},${p.b}`);
      }
      
      if (sizeEl) sizeEl.textContent = `${width}×${height}`;
      if (pixelsEl) pixelsEl.textContent = formatNumber(state.allPixels.length);
      if (colorsEl) colorsEl.textContent = colorSet.size;
      if (statusBadge) {
        statusBadge.textContent = 'LOADED';
        statusBadge.className = 'pp-status-badge pp-status-loaded';
      }
      
      // Show upload loaded state
      const uploadArea = document.getElementById('patplacer-upload-area');
      const uploadLoaded = document.getElementById('patplacer-upload-loaded');
      if (uploadArea) uploadArea.style.display = 'none';
      if (uploadLoaded) uploadLoaded.style.display = 'block';
    },

    // Save to local storage
    async saveToLocal() {
      try {
        const data = this.serializeState('Autosave');
        localStorage.setItem('patplacer_autosave', JSON.stringify(data));
        console.log('[PatPlacer] Auto-saved to localStorage');
      } catch (e) {
        console.warn('[PatPlacer] Auto-save failed', e);
      }
    },

    // Load from local storage
    async loadFromLocal() {
      try {
        const json = localStorage.getItem('patplacer_autosave');
        if (json) {
          const data = JSON.parse(json);
          await this.deserializeState(data);
          return true;
        }
      } catch (e) {
        console.error('[PatPlacer] Load failed:', e);
        updateStatus('Failed to load autosave - clearing corrupted data');
        localStorage.removeItem('patplacer_autosave'); // Clear bad data
      }
      return false;
    },

    // Check if autosave exists
    hasAutosave() {
      return !!localStorage.getItem('patplacer_autosave');
    },

    // Clear autosave
    clearAutosave() {
      localStorage.removeItem('patplacer_autosave');
      updateStatus('Autosave cleared');
      const btn = document.getElementById('patplacer-restore-btn');
      if (btn) btn.style.display = 'none';
    },

    // Export to file
    exportToFile() {
      const data = this.serializeState('PatPlacer Project');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patplacer-project-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      updateStatus('Project exported to file');
    },

    // Import from file
    importFromFile(file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          await this.deserializeState(data);
        } catch (err) {
          console.error('[PatPlacer] Import failed:', err);
          updateStatus('Error importing file: Invalid format');
        }
      };
      reader.readAsText(file);
    }
  };

  // ============================================================
  // UI PANEL
  // ============================================================
  function createPanel() {
    if (document.getElementById(CONFIG.PANEL_ID)) {
      return document.getElementById(CONFIG.PANEL_ID);
    }

    const panel = document.createElement('div');
    panel.id = CONFIG.PANEL_ID;
    
    // Get extension base URL for icons from injected resources
    const iconBase = (window.__PATPLACER_RESOURCES__ && window.__PATPLACER_RESOURCES__.iconsBaseUrl)
      ? window.__PATPLACER_RESOURCES__.iconsBaseUrl
      : 'icons/';
    
    panel.innerHTML = `
      <!-- Floating Decorations -->
      <div class="pp-deco pp-deco-alien" style="background-image: url('${iconBase}alien.png')"></div>
      <div class="pp-deco pp-deco-star" style="background-image: url('${iconBase}star.png')"></div>
      <div class="pp-deco pp-deco-barrel" style="background-image: url('${iconBase}barrel.png')"></div>
      <div class="pp-deco pp-deco-wizard" style="background-image: url('${iconBase}wizard.png')"></div>
      <div class="pp-deco pp-deco-dragon" style="background-image: url('${iconBase}dragon.png')"></div>
      <div class="pp-deco pp-deco-girl" style="background-image: url('${iconBase}girl.png')"></div>
      <div class="pp-deco pp-deco-axe" style="background-image: url('${iconBase}axe.png')"></div>
      <div class="pp-deco pp-deco-night" style="background-image: url('${iconBase}night-sky.png')"></div>
      
      <!-- INFO PANEL - Left Side -->
      <div class="pp-info-panel" id="patplacer-info-panel">
        <div class="pp-info-panel-header">
          <img src="${iconBase}computer.png" class="pp-info-panel-icon" alt="">
          <span>INFO</span>
        </div>
        
        <!-- Preview Section -->
        <div class="pp-info-preview">
          <canvas id="patplacer-preview-canvas" class="pp-info-canvas"></canvas>
          <div class="pp-info-no-image" id="patplacer-no-image">
            <img src="${iconBase}crop.png" class="pp-no-image-icon" alt="">
            <span>No Image</span>
          </div>
        </div>
        
        <!-- Stats Section -->
        <div class="pp-info-stats">
          <div class="pp-info-stat">
            <img src="${iconBase}ruler.png" class="pp-info-stat-icon" alt="">
            <div class="pp-info-stat-data">
              <span class="pp-info-stat-value" id="patplacer-stat-size">--</span>
              <span class="pp-info-stat-label">SIZE</span>
            </div>
          </div>
          <div class="pp-info-stat">
            <img src="${iconBase}palette.png" class="pp-info-stat-icon" alt="">
            <div class="pp-info-stat-data">
              <span class="pp-info-stat-value" id="patplacer-stat-pixels">--</span>
              <span class="pp-info-stat-label">PIXELS</span>
            </div>
          </div>
          <div class="pp-info-stat">
            <img src="${iconBase}target.png" class="pp-info-stat-icon" alt="">
            <div class="pp-info-stat-data">
              <span class="pp-info-stat-value" id="patplacer-stat-colors">--</span>
              <span class="pp-info-stat-label">COLORS</span>
            </div>
          </div>
        </div>
        
        <!-- Palette Status Section -->
        <div class="pp-info-palette-status" id="patplacer-palette-status">
          <div class="pp-palette-status-row">
            <img src="${iconBase}palette.png" class="pp-info-stat-icon" alt="">
            <span class="pp-palette-status-text pp-pulse" id="patplacer-palette-text">WAITING...</span>
          </div>
          <div class="pp-color-swatches" id="patplacer-color-swatches"></div>
        </div>
        
        <!-- Progress Section -->
        <div class="pp-info-progress" id="patplacer-info-progress">
          <div class="pp-info-progress-header">
            <img src="${iconBase}play.png" class="pp-info-stat-icon" alt="">
            <span>PROGRESS</span>
          </div>
          <div class="pp-info-progress-bar">
            <div class="pp-info-progress-fill" id="patplacer-info-progress-fill" style="width: 0%;"></div>
          </div>
          <div class="pp-info-progress-text">
            <span id="patplacer-info-placed">0</span> / <span id="patplacer-info-total">0</span>
          </div>
        </div>
      </div>
      
      <!-- Header -->
      <div class="pp-header">
        <img src="${iconBase}gameboy.png" class="pp-header-icon" alt="">
        <span class="pp-title">PATPLACER</span>
        <button class="pp-close-btn" id="patplacer-close">×</button>
      </div>
      
      <!-- Scrollable Content -->
      <div class="pp-content" id="patplacer-content">
        
        <!-- Project Section -->
        <div class="pp-section">
          <div class="pp-section-title">
            <img src="${iconBase}folder.png" class="pp-section-icon" alt="">Project
          </div>
          <div class="pp-btn-row">
            <button class="pp-btn pp-btn-small" id="patplacer-save-btn"><img src="${iconBase}save.png" class="pp-btn-icon" alt=""> Export</button>
            <button class="pp-btn pp-btn-small" id="patplacer-load-btn"><img src="${iconBase}folder.png" class="pp-btn-icon" alt=""> Import</button>
          </div>
          <input type="file" id="patplacer-import-input" accept=".json" style="display: none;">
          <div id="patplacer-autosave-row" style="display: none; margin-top: 6px;">
            <div class="pp-btn-row">
              <button class="pp-btn pp-btn-small pp-btn-warning" id="patplacer-restore-btn"><img src="${iconBase}potion.png" class="pp-btn-icon" alt=""> Restore</button>
              <button class="pp-btn pp-btn-small pp-btn-danger" id="patplacer-clear-save-btn"><img src="${iconBase}trash.png" class="pp-btn-icon" alt=""> Delete</button>
            </div>
          </div>
        </div>

        <!-- Image Section -->
        <div class="pp-section">
          <div class="pp-section-title">
            <img src="${iconBase}crop.png" class="pp-section-icon" alt="">Image
          </div>
          
          <!-- Simple Upload Widget -->
          <div class="pp-upload-card" id="patplacer-upload-card">
            <input type="file" id="patplacer-file-input" accept="image/*" style="display: none;">
            
            <!-- Empty State - Drop Zone -->
            <div class="pp-upload-empty" id="patplacer-upload-area">
              <img src="${iconBase}crop.png" class="pp-upload-icon" alt="">
              <div class="pp-upload-text">DROP IMAGE</div>
              <div class="pp-upload-subtext">or click to browse</div>
            </div>
            
            <!-- Loaded State - Just buttons -->
            <div class="pp-upload-loaded" id="patplacer-upload-loaded" style="display: none;">
              <div class="pp-upload-status">
                <span class="pp-status-badge" id="patplacer-image-status">LOADED</span>
              </div>
              <div class="pp-upload-actions">
                <button class="pp-btn pp-btn-small" id="patplacer-change-image"><img src="${iconBase}gear.png" class="pp-btn-icon" alt=""> Change</button>
                <button class="pp-btn pp-btn-small pp-btn-primary" id="patplacer-process-btn"><img src="${iconBase}gear-pixel.png" class="pp-btn-icon" alt=""> Process</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Anchor Section -->
        <div class="pp-section">
          <div class="pp-section-title">
            <img src="${iconBase}location.png" class="pp-section-icon" alt="">Anchor
          </div>
          <div class="pp-anchor-display">
            <div class="pp-anchor-item">
              <div class="pp-anchor-label">Tile</div>
              <div class="pp-anchor-value" id="patplacer-tile-pos">--</div>
            </div>
            <div class="pp-anchor-item">
              <div class="pp-anchor-label">Pixel</div>
              <div class="pp-anchor-value" id="patplacer-pixel-pos">--</div>
            </div>
          </div>
          <div class="pp-anchor-buttons">
            <button class="pp-btn" id="patplacer-capture-btn"><img src="${iconBase}location.png" class="pp-btn-icon" alt=""> Set Anchor</button>
            <button class="pp-btn" id="patplacer-move-btn" style="display: none;" title="Move Artwork (WASD)"><img src="${iconBase}location.png" class="pp-btn-icon" alt=""> Move</button>
          </div>
          <div class="pp-info pp-blink" id="patplacer-capture-hint" style="display: none; margin-top: 6px; text-align: center;">
            Draw a pixel on the map...
          </div>
        </div>

        <!-- Placement Section -->
        <div class="pp-section pp-section-placement">
          <div class="pp-section-title">
            <img src="${iconBase}play.png" class="pp-section-icon" alt="">Placement
          </div>
          
          <!-- Robot decoration -->
          <div class="pp-section-deco" style="background-image: url('${iconBase}robot.png')"></div>
          
          <!-- Charges -->
          <div class="pp-charges">
            <img src="${iconBase}star.png" class="pp-charges-icon-img" alt="">
            <span class="pp-charges-value"><span id="patplacer-charges">--</span> / <span id="patplacer-max-charges">--</span></span>
            <button class="pp-btn pp-btn-small" id="patplacer-refresh-charges" style="margin-left: 8px; padding: 4px 6px;">↻</button>
          </div>
          
          <button class="pp-btn pp-btn-primary" id="patplacer-place-btn" disabled>
            <img src="${iconBase}games.png" class="pp-btn-icon" alt=""> <span id="patplacer-btn-text">Place Batch</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    
    setupPanelEvents(panel);
    makeDraggable(panel);

    return panel;
  }
  
  function setupPanelEvents(panel) {
    // Storage events
    panel.querySelector('#patplacer-save-btn').addEventListener('click', () => PatPlacerStorage.exportToFile());
    panel.querySelector('#patplacer-load-btn').addEventListener('click', () => panel.querySelector('#patplacer-import-input').click());
    panel.querySelector('#patplacer-import-input').addEventListener('change', (e) => {
      if (e.target.files.length > 0) PatPlacerStorage.importFromFile(e.target.files[0]);
    });
    panel.querySelector('#patplacer-restore-btn').addEventListener('click', async () => {
      if (await PatPlacerStorage.loadFromLocal()) {
        panel.querySelector('#patplacer-autosave-row').style.display = 'none';
      }
    });
    panel.querySelector('#patplacer-clear-save-btn').addEventListener('click', () => {
      PatPlacerStorage.clearAutosave();
      panel.querySelector('#patplacer-autosave-row').style.display = 'none';
    });

    // Close button
    panel.querySelector('#patplacer-close').addEventListener('click', () => {
      hidePanel();
    });

    // File upload
    const uploadArea = panel.querySelector('#patplacer-upload-area');
    const fileInput = panel.querySelector('#patplacer-file-input');

    uploadArea.addEventListener('click', () => {
      if (!state.colorsCaptured) {
        updateStatus('⚠️ Open the color picker first to capture your available colors');
        return;
      }
      fileInput.click();
    });
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = 'var(--pp-accent)';
    });
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = '';
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '';
      if (!state.colorsCaptured) {
        updateStatus('⚠️ Open the color picker first to capture your available colors');
        return;
      }
      if (e.dataTransfer.files.length > 0) {
        handleImageUpload(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleImageUpload(e.target.files[0]);
      }
    });
    
    // Change image button (in mission card)
    panel.querySelector('#patplacer-change-image').addEventListener('click', () => fileInput.click());
    
    // Process button (opens processing panel)
    panel.querySelector('#patplacer-process-btn').addEventListener('click', showProcessingPanel);

    // Capture anchor button
    panel.querySelector('#patplacer-capture-btn').addEventListener('click', startDraftCapture);
    
    // Move artwork button
    panel.querySelector('#patplacer-move-btn').addEventListener('click', showMoveArtworkPanel);

    // Refresh charges button
    panel.querySelector('#patplacer-refresh-charges').addEventListener('click', fetchCharges);

    // Place drafts button
    panel.querySelector('#patplacer-place-btn').addEventListener('click', placeNextBatch);
  }

  function makeDraggable(panel) {
    const header = panel.querySelector('.pp-header');
    let isDragging = false;
    let offsetX, offsetY;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.pp-close-btn')) return;
      isDragging = true;
      offsetX = e.clientX - panel.offsetLeft;
      offsetY = e.clientY - panel.offsetTop;
      panel.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panel.style.left = `${e.clientX - offsetX}px`;
      panel.style.top = `${e.clientY - offsetY}px`;
      panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      panel.style.cursor = '';
    });
  }

  function showPanel() {
    const panel = document.getElementById(CONFIG.PANEL_ID) || createPanel();
    panel.style.display = 'block';
    state.panelVisible = true;
    window.postMessage({ source: 'patplacer-main', action: 'panelOpened' }, '*');
  }

  function hidePanel() {
    const panel = document.getElementById(CONFIG.PANEL_ID);
    if (panel) {
      panel.style.display = 'none';
    }
    state.panelVisible = false;
    window.postMessage({ source: 'patplacer-main', action: 'panelClosed' }, '*');
  }

  function togglePanel() {
    if (state.panelVisible) {
      hidePanel();
    } else {
      showPanel();
    }
  }

  function updateStatus(message) {
    const statusEl = document.getElementById('patplacer-status');
    if (statusEl) {
      statusEl.textContent = message;
    }
    console.log(`[PatPlacer] ${message}`);
  }

  // ============================================================
  // MOVE ARTWORK PANEL
  // ============================================================
  let moveArtworkPanelOpen = false;
  let moveKeydownHandler = null;
  let moveKeyupHandler = null;
  
  function showMoveArtworkPanel() {
    if (!state.anchorSet) {
      updateStatus('Set anchor first before moving artwork');
      return;
    }
    
    // Check if panel already exists
    if (document.getElementById('patplacer-move-panel')) {
      return;
    }
    
    moveArtworkPanelOpen = true;
    
    const movePanel = document.createElement('div');
    movePanel.id = 'patplacer-move-panel';
    movePanel.className = 'pp-move-panel';
    
    movePanel.innerHTML = `
      <div class="pp-move-header">
        <span class="pp-move-title">Move Artwork</span>
        <button class="pp-move-close" id="patplacer-move-close">✕</button>
      </div>
      <div class="pp-move-controls">
        <div></div>
        <button class="pp-move-btn" id="pp-move-up" title="Move Up (W)">▲</button>
        <div></div>
        <button class="pp-move-btn" id="pp-move-left" title="Move Left (A)">◄</button>
        <div class="pp-move-center">1px</div>
        <button class="pp-move-btn" id="pp-move-right" title="Move Right (D)">►</button>
        <div></div>
        <button class="pp-move-btn" id="pp-move-down" title="Move Down (S)">▼</button>
        <div></div>
      </div>
      <div class="pp-move-hint">Use WASD or Arrow keys</div>
    `;
    
    document.body.appendChild(movePanel);
    
    // Make draggable
    const header = movePanel.querySelector('.pp-move-header');
    let isDragging = false;
    let offsetX, offsetY;
    
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.pp-move-close')) return;
      isDragging = true;
      offsetX = e.clientX - movePanel.offsetLeft;
      offsetY = e.clientY - movePanel.offsetTop;
      movePanel.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      movePanel.style.left = `${e.clientX - offsetX}px`;
      movePanel.style.top = `${e.clientY - offsetY}px`;
      movePanel.style.transform = 'none';
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
      movePanel.style.cursor = '';
    });
    
    // Move artwork function
    function moveArtwork(deltaX, deltaY) {
      if (!state.anchorSet) return;
      
      // Update anchor pixel position
      state.anchorPixel.x += deltaX;
      state.anchorPixel.y += deltaY;
      
      // Handle tile overflow
      while (state.anchorPixel.x < 0) {
        state.anchorPixel.x += CONFIG.TILE_SIZE;
        state.anchorTile.x -= 1;
      }
      while (state.anchorPixel.x >= CONFIG.TILE_SIZE) {
        state.anchorPixel.x -= CONFIG.TILE_SIZE;
        state.anchorTile.x += 1;
      }
      while (state.anchorPixel.y < 0) {
        state.anchorPixel.y += CONFIG.TILE_SIZE;
        state.anchorTile.y -= 1;
      }
      while (state.anchorPixel.y >= CONFIG.TILE_SIZE) {
        state.anchorPixel.y -= CONFIG.TILE_SIZE;
        state.anchorTile.y += 1;
      }
      
      // Update UI
      document.getElementById('patplacer-tile-pos').textContent = `(${state.anchorTile.x}, ${state.anchorTile.y})`;
      document.getElementById('patplacer-pixel-pos').textContent = `(${state.anchorPixel.x}, ${state.anchorPixel.y})`;
      
      console.log(`[PatPlacer] Moved to tile (${state.anchorTile.x}, ${state.anchorTile.y}), pixel (${state.anchorPixel.x}, ${state.anchorPixel.y})`);
      
      // Update overlay if enabled - use correct function based on overlay mode
      if (state.templateOverlayEnabled) {
        processImageIntoChunks().then(() => {
          triggerMapRefresh();
        });
      } else if (state.draftOverlayEnabled) {
        processPlacedPixelsIntoChunks().then(() => {
          triggerMapRefresh();
        });
      }
    }
    
    // Button click handlers
    document.getElementById('pp-move-up').addEventListener('click', () => moveArtwork(0, -1));
    document.getElementById('pp-move-down').addEventListener('click', () => moveArtwork(0, 1));
    document.getElementById('pp-move-left').addEventListener('click', () => moveArtwork(-1, 0));
    document.getElementById('pp-move-right').addEventListener('click', () => moveArtwork(1, 0));
    
    // Keyboard handling (WASD + Arrow keys)
    const keysPressed = new Set();
    
    moveKeydownHandler = (e) => {
      if (!moveArtworkPanelOpen) return;
      
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        
        if (keysPressed.has(key)) return; // Already pressed
        keysPressed.add(key);
        
        switch (key) {
          case 'w':
          case 'arrowup':
            moveArtwork(0, -1);
            break;
          case 's':
          case 'arrowdown':
            moveArtwork(0, 1);
            break;
          case 'a':
          case 'arrowleft':
            moveArtwork(-1, 0);
            break;
          case 'd':
          case 'arrowright':
            moveArtwork(1, 0);
            break;
        }
      }
    };
    
    moveKeyupHandler = (e) => {
      const key = e.key.toLowerCase();
      keysPressed.delete(key);
    };
    
    document.addEventListener('keydown', moveKeydownHandler);
    document.addEventListener('keyup', moveKeyupHandler);
    
    // Close panel
    function closeMovePanel() {
      moveArtworkPanelOpen = false;
      
      // Remove keyboard handlers
      if (moveKeydownHandler) {
        document.removeEventListener('keydown', moveKeydownHandler);
        moveKeydownHandler = null;
      }
      if (moveKeyupHandler) {
        document.removeEventListener('keyup', moveKeyupHandler);
        moveKeyupHandler = null;
      }
      
      // Remove panel
      if (movePanel.parentNode) {
        movePanel.parentNode.removeChild(movePanel);
      }
    }
    
    document.getElementById('patplacer-move-close').addEventListener('click', closeMovePanel);
  }

  // Format large numbers with K/M suffix
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  // ============================================================
  // IMAGE HANDLING
  // ============================================================
  async function handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
      updateStatus('Error: Please upload an image file');
      return;
    }

    updateStatus('Loading image...');

    try {
      const bitmap = await createImageBitmap(file);
      
      // Store original for processing
      state.originalBitmap = bitmap;
      state.originalWidth = bitmap.width;
      state.originalHeight = bitmap.height;
      state.originalImageLoaded = true;
      
      // Also set as current image (for direct use without processing)
      state.imageBitmap = bitmap;
      state.imageWidth = bitmap.width;
      state.imageHeight = bitmap.height;
      
      // Reset processing settings to defaults when new image is uploaded
      // The defaults include resize to max 100 pixels while maintaining aspect ratio
      const maxDim = 100;
      let defaultWidth, defaultHeight;
      
      if (bitmap.width <= maxDim && bitmap.height <= maxDim) {
        // Image is already small enough
        defaultWidth = bitmap.width;
        defaultHeight = bitmap.height;
      } else if (bitmap.width >= bitmap.height) {
        // Landscape or square
        defaultWidth = maxDim;
        defaultHeight = Math.round(bitmap.height * (maxDim / bitmap.width));
      } else {
        // Portrait
        defaultHeight = maxDim;
        defaultWidth = Math.round(bitmap.width * (maxDim / bitmap.height));
      }
      
      resetProcessingSettings(defaultWidth, defaultHeight);
      
      // Apply default processing immediately so preview matches processing panel defaults
      // This ensures consistency between initial preview and what "Apply" would produce
      await applyDefaultProcessing();
      
      // Get full resolution image data for processing (only used as fallback)
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = state.imageWidth;
      fullCanvas.height = state.imageHeight;
      const fullCtx = fullCanvas.getContext('2d');
      fullCtx.drawImage(state.imageBitmap, 0, 0);
      state.imageData = fullCtx.getImageData(0, 0, state.imageWidth, state.imageHeight);

      // Count unique colors
      const colorSet = new Set();
      const data = state.imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) { // Only count non-transparent
          colorSet.add(`${data[i]},${data[i+1]},${data[i+2]}`);
        }
      }
      const uniqueColors = colorSet.size;

      // Update Upload Card UI
      document.getElementById('patplacer-upload-area').style.display = 'none';
      document.getElementById('patplacer-upload-loaded').style.display = 'block';
      
      // Update info panel
      const noImageEl = document.getElementById('patplacer-no-image');
      if (noImageEl) noImageEl.style.display = 'none';
      const previewCanvas = document.getElementById('patplacer-preview-canvas');
      if (previewCanvas) previewCanvas.style.display = 'block';
      
      // Update stats in info panel
      const sizeEl = document.getElementById('patplacer-stat-size');
      const pixelsEl = document.getElementById('patplacer-stat-pixels');
      const colorsEl = document.getElementById('patplacer-stat-colors');
      const statusBadge = document.getElementById('patplacer-image-status');
      
      if (sizeEl) sizeEl.textContent = `${bitmap.width}×${bitmap.height}`;
      if (pixelsEl) pixelsEl.textContent = formatNumber(bitmap.width * bitmap.height);
      if (colorsEl) colorsEl.textContent = uniqueColors;
      if (statusBadge) {
        statusBadge.textContent = 'LOADED';
        statusBadge.className = 'pp-status-badge pp-status-loaded';
      }
      
      // Update processing settings with original dimensions
      processingSettings.width = bitmap.width;
      processingSettings.height = bitmap.height;
      
      state.imageLoaded = true;
      buildPixelList();
      
      // Update preview to show quantized version (palette-mapped colors)
      updateInfoPanelPreview();
      
      updatePlaceButtonState();
      
      updateStatus(`Image loaded: ${bitmap.width}×${bitmap.height}`);
    } catch (error) {
      console.error('[PatPlacer] Error loading image:', error);
      updateStatus('Error loading image');
    }
  }
  
  /**
   * Update the processing preview
   */
  async function updateProcessingPreview() {
    if (!state.originalBitmap) {
      updateStatus('No image loaded');
      return;
    }
    
    updateStatus('Processing preview...');
    
    try {
      // Initialize processor if needed
      if (!imageProcessor) {
        if (window.PatPlacerImageProcessor) {
          imageProcessor = new window.PatPlacerImageProcessor();
        } else {
          console.warn('[PatPlacer] Image processor not available, using basic processing');
          // Fallback: just resize without advanced processing
          await applyBasicProcessing();
          return;
        }
      }
      
      // Load original image into processor
      await imageProcessor.loadFromBitmap(state.originalBitmap);
      
      // Apply color corrections (before resize for better quality)
      if (processingSettings.brightness !== 0 || processingSettings.contrast !== 0 || processingSettings.saturation !== 0 || processingSettings.hue !== 0 || processingSettings.gamma !== 100) {
        imageProcessor.adjustColors({
          brightness: processingSettings.brightness,
          contrast: processingSettings.contrast,
          saturation: processingSettings.saturation,
          hue: processingSettings.hue,
          gamma: processingSettings.gamma / 100
        });
      }
      
      // Apply blur (only if blur mode is not 'none' and radius > 0)
      if (processingSettings.blur > 0 && processingSettings.blurMode && processingSettings.blurMode !== 'none') {
        imageProcessor.blur(processingSettings.blurMode, processingSettings.blur);
      }
      
      // Apply sharpen
      if (processingSettings.sharpen > 0) {
        imageProcessor.sharpen(processingSettings.sharpen / 100);
      }
      
      // Resize
      imageProcessor.resize(
        processingSettings.width,
        processingSettings.height,
        processingSettings.resamplingMethod
      );

      // Edge Detection
      if (processingSettings.edgeThickness > 0) {
        imageProcessor.edgeOverlay(
          processingSettings.edgeAlgorithm || 'sobel',
          processingSettings.edgeThreshold || 60,
          processingSettings.edgeThickness,
          processingSettings.edgeThin || false
        );
      }

      // Post-Processing
      if (processingSettings.posterize < 32) {
        imageProcessor.posterize(processingSettings.posterize);
      }
      if (processingSettings.modeFilter > 0) {
        imageProcessor.modeFilter(processingSettings.modeFilter);
      }
      if (processingSettings.simplify > 0) {
        imageProcessor.simplify(processingSettings.simplify);
      }
      if (processingSettings.erode > 0) {
        imageProcessor.erode(processingSettings.erode);
      }
      
      // Transparency options
      const transparencyOptions = {
        paintTransparentPixels: processingSettings.paintTransparent,
        paintWhitePixels: processingSettings.paintWhite,
        transparencyThreshold: processingSettings.transparencyThreshold,
        whiteThreshold: processingSettings.whiteThreshold
      };

      // Apply dithering (to palette)
      if (processingSettings.ditheringEnabled) {
        imageProcessor.dither(
          processingSettings.ditheringMethod,
          CONFIG.COLOR_PALETTE,
          processingSettings.ditheringStrength,
          processingSettings.colorMatchingMethod,
          transparencyOptions
        );
      } else {
        // Just quantize to palette without dithering
        imageProcessor.quantize(
          CONFIG.COLOR_PALETTE, 
          processingSettings.colorMatchingMethod,
          transparencyOptions
        );
      }
      
      // Get result and update preview - show at ACTUAL SIZE (1:1)
      const resultCanvas = imageProcessor.getCanvas();
      const previewCanvas = document.getElementById('patplacer-proc-preview');
      
      // Set canvas to actual processed size (not scaled down)
      previewCanvas.width = resultCanvas.width;
      previewCanvas.height = resultCanvas.height;
      
      const previewCtx = previewCanvas.getContext('2d');
      previewCtx.imageSmoothingEnabled = false;
      previewCtx.drawImage(resultCanvas, 0, 0);
      
      // Update info
      document.getElementById('patplacer-output-size').textContent = 
        `${processingSettings.width} × ${processingSettings.height}`;
      
      // Count non-transparent pixels
      const imgData = previewCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
      let pixelCount = 0;
      for (let i = 3; i < imgData.data.length; i += 4) {
        if (imgData.data[i] >= 128) pixelCount++;
      }
      const pixelCountEl = document.getElementById('patplacer-proc-pixel-count');
      if (pixelCountEl) pixelCountEl.textContent = pixelCount.toLocaleString();
      
      updateStatus('Preview updated');
    } catch (error) {
      console.error('[PatPlacer] Preview error:', error);
      updateStatus('Error generating preview');
    }
  }
  
  /**
   * Basic processing fallback (no image processor)
   */
  async function applyBasicProcessing() {
    const canvas = document.createElement('canvas');
    canvas.width = processingSettings.width;
    canvas.height = processingSettings.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = processingSettings.resamplingMethod !== 'nearest';
    ctx.drawImage(state.originalBitmap, 0, 0, processingSettings.width, processingSettings.height);
    
    const previewCanvas = document.getElementById('patplacer-proc-preview');
    const previewCtx = previewCanvas.getContext('2d');
    const scale = Math.min(280 / canvas.width, 150 / canvas.height, 1);
    previewCanvas.width = canvas.width * scale;
    previewCanvas.height = canvas.height * scale;
    previewCtx.imageSmoothingEnabled = false;
    previewCtx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
    
    document.getElementById('patplacer-output-size').textContent = 
      `${processingSettings.width} × ${processingSettings.height}`;
    
    updateStatus('Preview updated (basic mode)');
  }
  
  /**
   * Show the processing panel overlay
   */
  function showProcessingPanel() {
    console.log('[PatPlacer] showProcessingPanel called');
    
    // Create processing panel if doesn't exist
    let procPanel = document.getElementById('patplacer-processing-overlay');
    if (!procPanel) {
      console.log('[PatPlacer] Creating processing panel');
      procPanel = createProcessingPanel();
      document.body.appendChild(procPanel);
    }
    
    // Initialize processing settings with current image dimensions
    if (state.originalBitmap) {
      processingSettings.width = state.originalWidth;
      processingSettings.height = state.originalHeight;
      
      // Update input fields with new IDs
      const widthInput = document.getElementById('pp-resize-width');
      const heightInput = document.getElementById('pp-resize-height');
      if (widthInput) widthInput.value = processingSettings.width;
      if (heightInput) heightInput.value = processingSettings.height;
    }
    
    // Update UI to reflect current settings
    updateProcessingPanelUI();
    
    // Show overlay with flex display for centering
    procPanel.style.display = 'flex';
    console.log('[PatPlacer] Processing panel now visible');
    
    // Generate initial preview and auto-fit
    setTimeout(async () => {
      await updateProcessingPreview();
      // Auto-fit after preview is rendered
      setTimeout(() => {
        const fitBtn = document.getElementById('pp-zoom-fit');
        if (fitBtn) fitBtn.click();
      }, 50);
    }, 100);
  }
  
  /**
   * Hide the processing panel overlay
   */
  function hideProcessingPanel() {
    const procPanel = document.getElementById('patplacer-processing-overlay');
    if (procPanel) {
      procPanel.style.display = 'none';
    }
  }
  
  /**
   * Create the processing panel overlay
   */
  function createProcessingPanel() {
    const iconBase = CONFIG.ICON_BASE;
    const overlay = document.createElement('div');
    overlay.id = 'patplacer-processing-overlay';
    overlay.className = 'pp-processing-overlay';
    
    overlay.innerHTML = `
      <div id="patplacer-processing-panel" class="pp-resize-container">
        <!-- Floating Decorations -->
        <div class="pp-deco pp-deco-proc-dragon" style="background-image: url('${iconBase}dragon.png')"></div>
        <div class="pp-deco pp-deco-proc-sword" style="background-image: url('${iconBase}sword.png')"></div>
        <div class="pp-deco pp-deco-proc-potion" style="background-image: url('${iconBase}potion.png')"></div>
        <div class="pp-deco pp-deco-proc-star" style="background-image: url('${iconBase}star.png')"></div>
        <div class="pp-deco pp-deco-proc-robot" style="background-image: url('${iconBase}robot.png')"></div>
        <div class="pp-deco pp-deco-proc-monster" style="background-image: url('${iconBase}monster.png')"></div>
        
        <!-- Header -->
        <div class="pp-resize-header">
          <span class="pp-resize-title"><img src="${iconBase}gear-pixel.png" class="pp-title-icon" alt=""> Resize & Process Image</span>
          <button id="patplacer-proc-close" class="pp-resize-close">✕</button>
        </div>
        
        <!-- Two Column Layout -->
        <div class="pp-resize-two-column">
          <!-- LEFT COLUMN: Settings (Scrollable) -->
          <div class="pp-resize-config-column">
            <div class="pp-resize-config-scroll">
              
              <!-- RESIZE TOOLS SECTION -->
              <div class="pp-section" id="pp-resize-section">
                <div class="pp-section-title">
                  <span><img src="${iconBase}ruler-pixel.png" class="pp-section-icon" alt=""> Resize Tools</span>
                </div>
                <div class="pp-section-content">
                  <div class="pp-resize-controls">
                    <div class="pp-size-inputs">
                      <div class="pp-size-group">
                        <label>Width</label>
                        <input type="number" id="pp-resize-width" class="pp-input" value="100" min="1" max="2000">
                      </div>
                      <span class="pp-size-separator">×</span>
                      <div class="pp-size-group">
                        <label>Height</label>
                        <input type="number" id="pp-resize-height" class="pp-input" value="100" min="1" max="2000">
                      </div>
                      <label class="pp-checkbox-label" title="Lock aspect ratio">
                        <input type="checkbox" id="pp-lock-aspect" checked>
                        <img src="${iconBase}chain.png" class="pp-lock-icon" alt="">
                      </label>
                    </div>
                  </div>
                  
                  <div class="pp-control-row">
                    <label class="pp-label">Resampling</label>
                    <select id="pp-resampling" class="pp-select">
                      <option value="nearest">Nearest Neighbor</option>
                      <option value="bilinear">Bilinear</option>
                      <option value="bicubic">Bicubic</option>
                      <option value="lanczos">Lanczos</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- PRE-PROCESSING SECTION -->
              <div class="pp-section" id="pp-preprocess-section">
                <div class="pp-section-title">
                  <span><img src="${iconBase}potion.png" class="pp-section-icon" alt=""> Pre Processing</span>
                </div>
                <div class="pp-section-content">
                  <!-- Pre-Blur -->
                  <div class="pp-subsection">
                    <div class="pp-subsection-header">
                      <span class="pp-subsection-title"><img src="${iconBase}droplet.png" class="pp-subsection-icon" alt=""> Pre-Blur (Anti-Aliasing)</span>
                    </div>
                    <div class="pp-description">Apply blur before downscaling to reduce moiré patterns</div>
                    <select id="pp-blur-mode" class="pp-select">
                      <option value="none">None - No pre-blur</option>
                      <option value="box">Box Blur - Fast separable filter</option>
                      <option value="gaussian">Gaussian Blur - Smooth natural blur</option>
                      <option value="kuwahara">Kuwahara - Edge-preserving smoothing</option>
                    </select>
                    
                    <div id="pp-blur-radius-control" class="pp-slider-control" style="display: none;">
                      <div class="pp-slider-header">
                        <span>Blur Radius</span>
                        <span class="pp-slider-value" data-for="pp-blur-radius">0</span>
                      </div>
                      <input type="range" id="pp-blur-radius" class="pp-slider" min="0" max="20" value="0">
                    </div>
                  </div>
                  
                  <!-- Sharpening -->
                  <div class="pp-subsection">
                    <div class="pp-subsection-header">
                      <span class="pp-subsection-title"><img src="${iconBase}knife.png" class="pp-subsection-icon" alt=""> Sharpening (Unsharp Mask)</span>
                    </div>
                    <div class="pp-description">Enhance edges and details after processing</div>
                    <div class="pp-slider-control">
                      <div class="pp-slider-header">
                        <span>Amount</span>
                        <span class="pp-slider-value" data-for="pp-sharpen">0</span>
                      </div>
                      <input type="range" id="pp-sharpen" class="pp-slider" min="0" max="100" value="0">
                    </div>
                  </div>
                </div>
              </div>

              <!-- DITHERING SECTION -->
              <div class="pp-section" id="pp-dithering-section">
                <div class="pp-section-title">
                  <span><img src="${iconBase}palette.png" class="pp-section-icon" alt=""> Dithering</span>
                </div>
                <div class="pp-section-content">
                  <!-- Enable Toggle -->
                  <div class="pp-toggle-row">
                    <div class="pp-toggle-content">
                      <span class="pp-toggle-label">Enable Dithering</span>
                      <div class="pp-description">Apply dithering to smooth color transitions</div>
                    </div>
                    <input type="checkbox" id="pp-dither-toggle" class="pp-checkbox">
                  </div>
                  
                  <!-- Dithering Method -->
                  <div id="pp-dither-method-control" style="display: none;">
                    <label class="pp-label">Dithering Method</label>
                    <select id="pp-dither-method" class="pp-select">
                      <optgroup label="❯ Error Diffusion">
                        <option value="floyd-steinberg">Floyd-Steinberg - Classic balanced</option>
                      </optgroup>
                      <optgroup label="❯ Ordered Dithering">
                        <option value="bayer2">Bayer 2×2 - Coarse checkerboard</option>
                        <option value="bayer4">Bayer 4×4 - Medium halftone</option>
                        <option value="bayer8">Bayer 8×8 - Fine halftone</option>
                        <option value="random">Random Noise - Stochastic</option>
                      </optgroup>
                    </select>
                    <div class="pp-description">
                      <strong>Floyd-Steinberg:</strong> Natural, smooth gradients<br>
                      <strong>Ordered:</strong> Retro patterns, adjustable strength
                    </div>
                  </div>
                  
                  <!-- Dithering Strength -->
                  <div id="pp-dither-strength-control" class="pp-slider-control" style="display: none;">
                    <div class="pp-slider-header">
                      <span>Dithering Strength</span>
                      <span class="pp-slider-value" data-for="pp-dither-strength">0.50</span>
                    </div>
                    <input type="range" id="pp-dither-strength" class="pp-slider" min="0" max="100" value="50">
                    <div class="pp-description">Controls pattern intensity (ordered only)</div>
                  </div>
                  
                  <!-- Info Box -->
                  <div class="pp-info-box">
                    <img src="${iconBase}bulb.png" class="pp-tip-icon" alt=""> <strong>Tip:</strong> Dithering smooths gradients and reduces color banding.
                  </div>
                </div>
              </div>

              <!-- POST-PROCESSING SECTION -->
              <div class="pp-section" id="pp-postprocess-section">
                <div class="pp-section-title">
                  <span><img src="${iconBase}sword.png" class="pp-section-icon" alt=""> Post-Processing</span>
                </div>
                <div class="pp-section-content">
                  <!-- Edge Overlay Toggle -->
                  <div class="pp-toggle-row">
                    <div class="pp-toggle-content">
                      <span class="pp-toggle-label"><img src="${iconBase}pen.png" class="pp-toggle-icon" alt=""> Edge Overlay</span>
                      <div class="pp-description">Highlight edges with black outlines</div>
                    </div>
                    <input type="checkbox" id="pp-edge-enable" class="pp-checkbox">
                  </div>
                  
                  <!-- Edge Controls -->
                  <div id="pp-edge-controls" style="display: none;">
                    <label class="pp-label">Edge Detection Algorithm</label>
                    <select id="pp-edge-algorithm" class="pp-select">
                      <option value="sobel">Sobel (Sensitive to Edges)</option>
                      <option value="prewitt">Prewitt (Balanced)</option>
                      <option value="roberts">Roberts (Fast)</option>
                      <option value="laplacian">Laplacian (Zero Crossing)</option>
                    </select>
                    
                    <div class="pp-slider-control">
                      <div class="pp-slider-header">
                        <span>Edge Threshold</span>
                        <span class="pp-slider-value" data-for="pp-edge-threshold">60</span>
                      </div>
                      <input type="range" id="pp-edge-threshold" class="pp-slider" min="0" max="255" value="60">
                      <div class="pp-description">Edge detection sensitivity (0=subtle, 255=strong)</div>
                    </div>
                    
                    <div class="pp-slider-control">
                      <div class="pp-slider-header">
                        <span>Edge Thickness</span>
                        <span class="pp-slider-value" data-for="pp-edge-thickness">0</span>
                      </div>
                      <input type="range" id="pp-edge-thickness" class="pp-slider" min="0" max="6" value="0">
                    </div>
                    
                    <div class="pp-toggle-row pp-toggle-inline">
                      <span class="pp-toggle-label">Thin Edges (NMS)</span>
                      <input type="checkbox" id="pp-edge-thin" class="pp-checkbox">
                    </div>
                  </div>
                  
                  <!-- Other Post-Processing -->
                  <div class="pp-slider-control">
                    <div class="pp-slider-header">
                      <span>Simplify Regions (px)</span>
                      <span class="pp-slider-value" data-for="pp-simplify">0</span>
                    </div>
                    <input type="range" id="pp-simplify" class="pp-slider" min="0" max="500" value="0" step="10">
                    <div class="pp-description">Merge small regions to reduce complexity</div>
                  </div>
                  
                  <div class="pp-slider-control">
                    <div class="pp-slider-header">
                      <span>Erode Edges</span>
                      <span class="pp-slider-value" data-for="pp-erode">0</span>
                    </div>
                    <input type="range" id="pp-erode" class="pp-slider" min="0" max="8" value="0">
                    <div class="pp-description">Shrink edges inward to reduce noise</div>
                  </div>
                  
                  <div class="pp-slider-control">
                    <div class="pp-slider-header">
                      <span>Mode Filter (N×N)</span>
                      <span class="pp-slider-value" data-for="pp-mode-filter">0</span>
                    </div>
                    <input type="range" id="pp-mode-filter" class="pp-slider" min="0" max="10" value="0">
                    <div class="pp-description">Median filter to smooth regions (0 = off)</div>
                  </div>
                </div>
              </div>

              <!-- COLOR CORRECTION SECTION -->
              <div class="pp-section" id="pp-colorcorrect-section">
                <div class="pp-section-title">
                  <span>🌈 Color Correction</span>
                </div>
                <div class="pp-section-content">
                  <!-- Enable Toggle -->
                  <div class="pp-toggle-row">
                    <div class="pp-toggle-content">
                      <span class="pp-toggle-label">Enable Color Correction</span>
                      <div class="pp-description">Adjust brightness, contrast, saturation, hue, gamma</div>
                    </div>
                    <input type="checkbox" id="pp-color-correction-toggle" class="pp-checkbox">
                  </div>
                  
                  <!-- Color Correction Controls -->
                  <div id="pp-color-correction-controls" style="display: none;">
                    <div class="pp-slider-control">
                      <div class="pp-slider-header">
                        <span>Brightness (-100 to 100)</span>
                        <span class="pp-slider-value" data-for="pp-brightness">0</span>
                      </div>
                      <input type="range" id="pp-brightness" class="pp-slider" min="-100" max="100" value="0">
                    </div>
                    
                    <div class="pp-slider-control">
                      <div class="pp-slider-header">
                        <span>Contrast (-100 to 100)</span>
                        <span class="pp-slider-value" data-for="pp-contrast">0</span>
                      </div>
                      <input type="range" id="pp-contrast" class="pp-slider" min="-100" max="100" value="0">
                    </div>
                    
                    <div class="pp-slider-control">
                      <div class="pp-slider-header">
                        <span>Saturation (-100 to 100)</span>
                        <span class="pp-slider-value" data-for="pp-saturation">0</span>
                      </div>
                      <input type="range" id="pp-saturation" class="pp-slider" min="-100" max="100" value="0">
                    </div>
                    
                    <div class="pp-slider-control">
                      <div class="pp-slider-header">
                        <span>Hue Shift (-180 to 180°)</span>
                        <span class="pp-slider-value" data-for="pp-hue">0</span>
                      </div>
                      <input type="range" id="pp-hue" class="pp-slider" min="-180" max="180" value="0">
                    </div>
                    
                    <div class="pp-slider-control">
                      <div class="pp-slider-header">
                        <span>Gamma (0.1 to 3.0)</span>
                        <span class="pp-slider-value" data-for="pp-gamma">1.00</span>
                      </div>
                      <input type="range" id="pp-gamma" class="pp-slider" min="10" max="300" value="100">
                    </div>
                  </div>
                </div>
              </div>

              <!-- ADVANCED COLOR MATCHING SECTION -->
              <div class="pp-section" id="pp-colormatch-section">
                <div class="pp-section-title">
                  <span>🧪 Advanced Color Matching</span>
                </div>
                <div class="pp-section-content">
                  <div class="pp-control-row">
                    <label class="pp-label">Algorithm</label>
                    <select id="pp-color-match" class="pp-select">
                      <option value="lab" selected>Perceptual (Lab)</option>
                      <option value="rgb">Legacy (RGB)</option>
                      <option value="oklab">OKLAB (Modern Perceptual)</option>
                      <option value="ciede2000">CIEDE2000 (Best Quality)</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- TRANSPARENCY SECTION -->
              <div class="pp-section" id="pp-transparency-section">
                <div class="pp-section-title">
                  <span>🔲 Transparency</span>
                </div>
                <div class="pp-section-content">
                  <div class="pp-toggle-row">
                    <div class="pp-toggle-content">
                      <span class="pp-toggle-label">Paint Transparent Pixels</span>
                      <div class="pp-description">Include pixels below alpha threshold</div>
                    </div>
                    <input type="checkbox" id="pp-paint-transparent" class="pp-checkbox">
                  </div>
                  
                  <div class="pp-slider-control">
                    <div class="pp-slider-header">
                      <span>Transparency Threshold</span>
                      <span class="pp-slider-value" data-for="pp-transparency-threshold">128</span>
                    </div>
                    <input type="range" id="pp-transparency-threshold" class="pp-slider" min="0" max="255" value="128">
                  </div>
                </div>
              </div>
              
            </div>
          </div>
          
          <!-- RIGHT COLUMN: Preview (Fixed) -->
          <div class="pp-resize-preview-column">
            <!-- Zoom Controls -->
            <div class="pp-preview-zoom-controls">
              <button id="pp-zoom-out" class="pp-zoom-btn">−</button>
              <span id="pp-zoom-level">100%</span>
              <button id="pp-zoom-in" class="pp-zoom-btn">+</button>
              <button id="pp-zoom-fit" class="pp-zoom-btn">Fit</button>
              <button id="pp-zoom-reset" class="pp-zoom-btn">1:1</button>
            </div>
            
            <!-- Preview Canvas -->
            <div class="pp-preview-wrapper" id="pp-preview-wrapper">
              <div class="pp-canvas-stack" id="pp-canvas-stack">
                <canvas id="patplacer-proc-preview" class="pp-preview-canvas"></canvas>
              </div>
            </div>
            
            <!-- Info -->
            <div class="pp-preview-info">
              <span>Output: <strong id="patplacer-output-size">--</strong></span>
              <span>Pixels: <strong id="patplacer-proc-pixel-count">--</strong></span>
            </div>
            
            <!-- Help Text -->
            <div class="pp-preview-help">
              Scroll to zoom • Drag to pan
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="pp-resize-footer">
          <button id="patplacer-proc-cancel" class="pp-btn">Cancel</button>
          <button id="patplacer-proc-apply" class="pp-btn pp-btn-primary">Apply</button>
        </div>
      </div>
    `;
    
    // Setup event handlers
    try {
      setupProcessingPanelEvents(overlay);
    } catch (e) {
      console.error('[PatPlacer] Error setting up processing panel events:', e);
    }
    
    console.log('[PatPlacer] Processing panel created');
    return overlay;
  }
  
  /**
   * Setup event handlers for processing panel
   */
  function setupProcessingPanelEvents(overlay) {
    const panel = overlay.querySelector('#patplacer-processing-panel');
    
    // Close buttons
    overlay.querySelector('#patplacer-proc-close').addEventListener('click', hideProcessingPanel);
    overlay.querySelector('#patplacer-proc-cancel').addEventListener('click', hideProcessingPanel);
    
    // Size inputs with aspect ratio lock
    const widthInput = panel.querySelector('#pp-resize-width');
    const heightInput = panel.querySelector('#pp-resize-height');
    const lockAspect = panel.querySelector('#pp-lock-aspect');
    
    widthInput.addEventListener('change', () => {
      processingSettings.width = parseInt(widthInput.value) || 1;
      if (lockAspect.checked && state.originalWidth && state.originalHeight) {
        const ratio = state.originalHeight / state.originalWidth;
        processingSettings.height = Math.round(processingSettings.width * ratio);
        heightInput.value = processingSettings.height;
      }
      debouncePreview();
    });
    
    heightInput.addEventListener('change', () => {
      processingSettings.height = parseInt(heightInput.value) || 1;
      if (lockAspect.checked && state.originalWidth && state.originalHeight) {
        const ratio = state.originalWidth / state.originalHeight;
        processingSettings.width = Math.round(processingSettings.height * ratio);
        widthInput.value = processingSettings.width;
      }
      debouncePreview();
    });
    
    // Resampling
    panel.querySelector('#pp-resampling').addEventListener('change', (e) => {
      processingSettings.resamplingMethod = e.target.value;
      debouncePreview();
    });
    
    // Pre-processing: Blur Mode
    const blurMode = panel.querySelector('#pp-blur-mode');
    const blurRadiusControl = panel.querySelector('#pp-blur-radius-control');
    blurMode.addEventListener('change', (e) => {
      processingSettings.blurMode = e.target.value;
      blurRadiusControl.style.display = e.target.value === 'none' ? 'none' : 'block';
      if (e.target.value === 'none') {
        processingSettings.blur = 0;
        panel.querySelector('#pp-blur-radius').value = 0;
        panel.querySelector('[data-for="pp-blur-radius"]').textContent = '0';
      }
      debouncePreview();
    });
    
    // Pre-processing: Blur Radius
    panel.querySelector('#pp-blur-radius').addEventListener('input', (e) => {
      processingSettings.blur = parseInt(e.target.value);
      panel.querySelector('[data-for="pp-blur-radius"]').textContent = e.target.value;
      debouncePreview();
    });
    
    // Pre-processing: Sharpen
    panel.querySelector('#pp-sharpen').addEventListener('input', (e) => {
      processingSettings.sharpen = parseInt(e.target.value);
      panel.querySelector('[data-for="pp-sharpen"]').textContent = e.target.value;
      debouncePreview();
    });
    
    // Dithering enable/disable
    const ditherToggle = panel.querySelector('#pp-dither-toggle');
    const ditherMethodControl = panel.querySelector('#pp-dither-method-control');
    const ditherStrengthControl = panel.querySelector('#pp-dither-strength-control');
    
    ditherToggle.addEventListener('change', () => {
      processingSettings.ditheringEnabled = ditherToggle.checked;
      ditherMethodControl.style.display = ditherToggle.checked ? 'block' : 'none';
      ditherStrengthControl.style.display = ditherToggle.checked ? 'block' : 'none';
      debouncePreview();
    });
    
    panel.querySelector('#pp-dither-method').addEventListener('change', (e) => {
      processingSettings.ditheringMethod = e.target.value;
      debouncePreview();
    });
    
    panel.querySelector('#pp-dither-strength').addEventListener('input', (e) => {
      processingSettings.ditheringStrength = parseInt(e.target.value) / 100;
      panel.querySelector('[data-for="pp-dither-strength"]').textContent = (parseInt(e.target.value) / 100).toFixed(2);
      debouncePreview();
    });
    
    // Color matching
    panel.querySelector('#pp-color-match').addEventListener('change', (e) => {
      processingSettings.colorMatchingMethod = e.target.value;
      debouncePreview();
    });
    
    // Color Correction toggle
    const colorCorrectionToggle = panel.querySelector('#pp-color-correction-toggle');
    const colorCorrectionControls = panel.querySelector('#pp-color-correction-controls');
    colorCorrectionToggle.addEventListener('change', () => {
      colorCorrectionControls.style.display = colorCorrectionToggle.checked ? 'block' : 'none';
      debouncePreview();
    });
    
    // Color Correction Sliders
    ['brightness', 'contrast', 'saturation', 'hue', 'gamma'].forEach(prop => {
      const slider = panel.querySelector(`#pp-${prop}`);
      if (!slider) return;
      slider.addEventListener('input', (e) => {
        processingSettings[prop] = parseInt(e.target.value);
        const label = panel.querySelector(`[data-for="pp-${prop}"]`);
        if (label) {
          label.textContent = prop === 'gamma' ? (parseInt(e.target.value)/100).toFixed(2) : e.target.value;
        }
        debouncePreview();
      });
    });
    
    // Edge Overlay toggle
    const edgeEnable = panel.querySelector('#pp-edge-enable');
    const edgeControls = panel.querySelector('#pp-edge-controls');
    edgeEnable.addEventListener('change', () => {
      edgeControls.style.display = edgeEnable.checked ? 'block' : 'none';
      if (!edgeEnable.checked) {
        processingSettings.edgeThickness = 0;
      }
      debouncePreview();
    });
    
    // Edge Detection Controls
    panel.querySelector('#pp-edge-algorithm').addEventListener('change', (e) => {
      processingSettings.edgeAlgorithm = e.target.value;
      debouncePreview();
    });
    
    panel.querySelector('#pp-edge-threshold').addEventListener('input', (e) => {
      processingSettings.edgeThreshold = parseInt(e.target.value);
      panel.querySelector('[data-for="pp-edge-threshold"]').textContent = e.target.value;
      debouncePreview();
    });
    
    panel.querySelector('#pp-edge-thickness').addEventListener('input', (e) => {
      processingSettings.edgeThickness = parseInt(e.target.value);
      panel.querySelector('[data-for="pp-edge-thickness"]').textContent = e.target.value;
      debouncePreview();
    });
    
    panel.querySelector('#pp-edge-thin').addEventListener('change', (e) => {
      processingSettings.edgeThin = e.target.checked;
      debouncePreview();
    });
    
    // Post-Processing Sliders
    panel.querySelector('#pp-mode-filter').addEventListener('input', (e) => {
      processingSettings.modeFilter = parseInt(e.target.value);
      panel.querySelector('[data-for="pp-mode-filter"]').textContent = e.target.value;
      debouncePreview();
    });
    
    panel.querySelector('#pp-simplify').addEventListener('input', (e) => {
      processingSettings.simplify = parseInt(e.target.value);
      panel.querySelector('[data-for="pp-simplify"]').textContent = e.target.value;
      debouncePreview();
    });
    
    panel.querySelector('#pp-erode').addEventListener('input', (e) => {
      processingSettings.erode = parseInt(e.target.value);
      panel.querySelector('[data-for="pp-erode"]').textContent = e.target.value;
      debouncePreview();
    });
    
    // Transparency Controls
    panel.querySelector('#pp-paint-transparent').addEventListener('change', (e) => {
      processingSettings.paintTransparent = e.target.checked;
      debouncePreview();
    });
    
    panel.querySelector('#pp-transparency-threshold').addEventListener('input', (e) => {
      processingSettings.transparencyThreshold = parseInt(e.target.value);
      panel.querySelector('[data-for="pp-transparency-threshold"]').textContent = e.target.value;
      debouncePreview();
    });
    
    // Zoom controls
    let zoomLevel = 1;
    const zoomLevelEl = panel.querySelector('#pp-zoom-level');
    const canvasStack = panel.querySelector('#pp-canvas-stack');
    const previewWrapper = panel.querySelector('#pp-preview-wrapper');
    
    const updateZoom = () => {
      if (zoomLevelEl) zoomLevelEl.textContent = Math.round(zoomLevel * 100) + '%';
      if (canvasStack) canvasStack.style.transform = `scale(${zoomLevel})`;
    };
    
    panel.querySelector('#pp-zoom-in').addEventListener('click', () => {
      zoomLevel = Math.min(zoomLevel * 1.25, 10);
      updateZoom();
    });
    
    panel.querySelector('#pp-zoom-out').addEventListener('click', () => {
      zoomLevel = Math.max(zoomLevel / 1.25, 0.1);
      updateZoom();
    });
    
    panel.querySelector('#pp-zoom-reset').addEventListener('click', () => {
      zoomLevel = 1;
      updateZoom();
    });
    
    panel.querySelector('#pp-zoom-fit').addEventListener('click', () => {
      const canvas = panel.querySelector('#patplacer-proc-preview');
      if (canvas && previewWrapper) {
        const wrapperRect = previewWrapper.getBoundingClientRect();
        const fitX = (wrapperRect.width - 40) / canvas.width;
        const fitY = (wrapperRect.height - 40) / canvas.height;
        zoomLevel = Math.min(fitX, fitY, 4);
        updateZoom();
      }
    });
    
    // Mouse wheel zoom on preview
    if (previewWrapper) {
      previewWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoomLevel = Math.max(0.1, Math.min(10, zoomLevel * delta));
        updateZoom();
      });
      
      // Drag to pan
      let isDragging = false;
      let startX, startY, scrollLeft, scrollTop;
      
      previewWrapper.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.pageX - previewWrapper.offsetLeft;
        startY = e.pageY - previewWrapper.offsetTop;
        scrollLeft = previewWrapper.scrollLeft;
        scrollTop = previewWrapper.scrollTop;
        previewWrapper.style.cursor = 'grabbing';
      });
      
      previewWrapper.addEventListener('mouseleave', () => {
        isDragging = false;
        previewWrapper.style.cursor = 'grab';
      });
      
      previewWrapper.addEventListener('mouseup', () => {
        isDragging = false;
        previewWrapper.style.cursor = 'grab';
      });
      
      previewWrapper.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - previewWrapper.offsetLeft;
        const y = e.pageY - previewWrapper.offsetTop;
        const walkX = (x - startX) * 1.5;
        const walkY = (y - startY) * 1.5;
        previewWrapper.scrollLeft = scrollLeft - walkX;
        previewWrapper.scrollTop = scrollTop - walkY;
      });
    }
    
    // Apply button
    overlay.querySelector('#patplacer-proc-apply').addEventListener('click', applyProcessing);
  }
  
  /**
   * Apply default processing when image is first uploaded
   * This ensures the initial preview matches what the processing panel would produce
   */
  async function applyDefaultProcessing() {
    if (!state.originalBitmap) {
      return;
    }
    
    try {
      // Initialize processor if needed
      if (!imageProcessor) {
        if (window.PatPlacerImageProcessor) {
          imageProcessor = new window.PatPlacerImageProcessor();
        } else {
          console.warn('[PatPlacer] Image processor not available for default processing');
          // Fallback: just use original with basic quantization
          return;
        }
      }
      
      await imageProcessor.loadFromBitmap(state.originalBitmap);
      
      // Apply default resize (to processingSettings.width x processingSettings.height)
      // Default resampling is 'nearest'
      imageProcessor.resize(
        processingSettings.width,
        processingSettings.height,
        processingSettings.resamplingMethod || 'nearest'
      );
      
      // Apply default quantization (no dithering by default)
      // Default color matching is 'lab'
      const transparencyOptions = {
        paintTransparentPixels: processingSettings.paintTransparent || false,
        paintWhitePixels: processingSettings.paintWhite !== false,
        transparencyThreshold: processingSettings.transparencyThreshold || 128,
        whiteThreshold: processingSettings.whiteThreshold || 230
      };
      
      imageProcessor.quantize(
        CONFIG.COLOR_PALETTE,
        processingSettings.colorMatchingMethod || 'lab',
        transparencyOptions
      );
      
      // Get result
      const resultCanvas = imageProcessor.getCanvas();
      state.imageBitmap = await createImageBitmap(resultCanvas);
      state.imageWidth = resultCanvas.width;
      state.imageHeight = resultCanvas.height;
      
      // Get ImageData for buildPixelList
      const ctx = resultCanvas.getContext('2d');
      state.imageData = ctx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
      
      console.log(`[PatPlacer] Applied default processing: ${resultCanvas.width}×${resultCanvas.height}`);
    } catch (error) {
      console.error('[PatPlacer] Error applying default processing:', error);
      // On error, fall back to original behavior
    }
  }
  
  /**
   * Apply processing and prepare for placement
   */
  async function applyProcessing() {
    if (!state.originalBitmap) {
      updateStatus('No image loaded');
      return;
    }
    
    updateStatus('Applying processing...');
    
    try {
      // Process image (same as preview but save result)
      if (!imageProcessor) {
        if (window.PatPlacerImageProcessor) {
          imageProcessor = new window.PatPlacerImageProcessor();
        } else {
          updateStatus('Error: Image processor not available');
          return;
        }
      }
      
      await imageProcessor.loadFromBitmap(state.originalBitmap);
      
      // Apply color corrections
      if (processingSettings.brightness !== 0 || processingSettings.contrast !== 0 || processingSettings.saturation !== 0 || processingSettings.hue !== 0 || processingSettings.gamma !== 100) {
        imageProcessor.adjustColors({
          brightness: processingSettings.brightness,
          contrast: processingSettings.contrast,
          saturation: processingSettings.saturation,
          hue: processingSettings.hue,
          gamma: processingSettings.gamma / 100
        });
      }
      
      // Apply blur (only if blur mode is not 'none' and radius > 0)
      if (processingSettings.blur > 0 && processingSettings.blurMode && processingSettings.blurMode !== 'none') {
        imageProcessor.blur(processingSettings.blurMode, processingSettings.blur);
      }
      
      // Apply sharpen
      if (processingSettings.sharpen > 0) {
        imageProcessor.sharpen(processingSettings.sharpen / 100);
      }
      
      // Resize
      imageProcessor.resize(
        processingSettings.width,
        processingSettings.height,
        processingSettings.resamplingMethod
      );

      // Edge Detection
      if (processingSettings.edgeThickness > 0) {
        imageProcessor.edgeOverlay(
          processingSettings.edgeAlgorithm || 'sobel',
          processingSettings.edgeThreshold || 60,
          processingSettings.edgeThickness,
          processingSettings.edgeThin || false
        );
      }

      // Post-Processing
      if (processingSettings.posterize < 32) {
        imageProcessor.posterize(processingSettings.posterize);
      }
      if (processingSettings.modeFilter > 0) {
        imageProcessor.modeFilter(processingSettings.modeFilter);
      }
      if (processingSettings.simplify > 0) {
        imageProcessor.simplify(processingSettings.simplify);
      }
      if (processingSettings.erode > 0) {
        imageProcessor.erode(processingSettings.erode);
      }
      
      // Transparency options
      const transparencyOptions = {
        paintTransparentPixels: processingSettings.paintTransparent,
        paintWhitePixels: processingSettings.paintWhite,
        transparencyThreshold: processingSettings.transparencyThreshold,
        whiteThreshold: processingSettings.whiteThreshold
      };

      // Apply dithering or quantize
      if (processingSettings.ditheringEnabled) {
        imageProcessor.dither(
          processingSettings.ditheringMethod,
          CONFIG.COLOR_PALETTE,
          processingSettings.ditheringStrength,
          processingSettings.colorMatchingMethod,
          transparencyOptions
        );
      } else {
        imageProcessor.quantize(
          CONFIG.COLOR_PALETTE, 
          processingSettings.colorMatchingMethod,
          transparencyOptions
        );
      }
      
      // Get final result
      const resultCanvas = imageProcessor.getCanvas();
      state.imageBitmap = await createImageBitmap(resultCanvas);
      state.imageWidth = resultCanvas.width;
      state.imageHeight = resultCanvas.height;
      state.imageData = resultCanvas.getContext('2d').getImageData(0, 0, resultCanvas.width, resultCanvas.height);
      state.imageLoaded = true;
      
      // Build pixel list
      buildPixelList();
      
      // Hide processing panel overlay
      hideProcessingPanel();
      
      // Update info panel preview with quantized pixels
      updateInfoPanelPreview();
      
      // Update info panel stats
      const statSize = document.getElementById('patplacer-stat-size');
      const statPixels = document.getElementById('patplacer-stat-pixels');
      const imageStatus = document.getElementById('patplacer-image-status');
      
      if (statSize) statSize.textContent = `${resultCanvas.width}×${resultCanvas.height}`;
      if (statPixels) statPixels.textContent = formatNumber(state.allPixels.length);
      if (imageStatus) {
        imageStatus.textContent = 'READY';
        imageStatus.className = 'pp-status-badge pp-status-ready';
      }
      
      updatePlaceButtonState();
      updateStatus(`✓ Processed: ${state.allPixels.length.toLocaleString()} pixels ready`);
      
      // Refresh overlay if it's currently enabled
      if (state.templateOverlayEnabled || state.draftOverlayEnabled) {
        console.log('[PatPlacer] Refreshing overlay after processing...');
        processImageIntoChunks().then(() => {
          setTimeout(triggerMapRefresh, 200);
        });
      }
    } catch (error) {
      console.error('[PatPlacer] Apply error:', error);
      updateStatus('Error applying processing');
    }
  }

  /**
   * Update the info panel preview with quantized/palette-mapped image
   * This shows the actual colors that will be placed, not the original
   */
  function updateInfoPanelPreview() {
    if (!state.allPixels || state.allPixels.length === 0) return;
    
    const previewCanvas = document.getElementById('patplacer-preview-canvas');
    if (!previewCanvas) return;
    
    // Find dimensions from pixel coordinates
    let maxX = 0, maxY = 0;
    for (const p of state.allPixels) {
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const width = maxX + 1;
    const height = maxY + 1;
    
    // Create full-size canvas with quantized pixels
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = width;
    fullCanvas.height = height;
    const fullCtx = fullCanvas.getContext('2d');
    fullCtx.clearRect(0, 0, width, height);
    
    // Draw each pixel with palette color
    const imageData = fullCtx.createImageData(width, height);
    for (const p of state.allPixels) {
      const idx = (p.y * width + p.x) * 4;
      imageData.data[idx] = p.r;
      imageData.data[idx + 1] = p.g;
      imageData.data[idx + 2] = p.b;
      imageData.data[idx + 3] = 255;
    }
    fullCtx.putImageData(imageData, 0, 0);
    
    // Scale down for preview (max 80px to fit nicely)
    const maxSize = 80;
    const scale = Math.min(maxSize / width, maxSize / height, 1);
    previewCanvas.width = Math.max(width * scale, 32);
    previewCanvas.height = Math.max(height * scale, 32);
    
    const ctx = previewCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fullCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
    
    // Show canvas, hide placeholder
    previewCanvas.style.display = 'block';
    const noImageEl = document.getElementById('patplacer-no-image');
    if (noImageEl) noImageEl.style.display = 'none';
  }

  /**
   * Build the complete pixel list from the processed template
   * The image has already been quantized to palette colors
   */
  function buildPixelList() {
    if (!state.imageData) return;

    state.allPixels = [];
    const data = state.imageData.data;
    const width = state.imageWidth;
    
    // Debug: Track color usage
    const colorUsage = new Map();

    for (let y = 0; y < state.imageHeight; y++) {
      for (let x = 0; x < state.imageWidth; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent pixels (hardcoded behavior)
        if (a < 128) continue;

        // Find the color in our palette (should be exact match after quantization)
        const color = findExactOrClosestColor(r, g, b);
        if (color) {
          state.allPixels.push({
            x,
            y,
            r: color.r,
            g: color.g,
            b: color.b,
            colorIdx: color.id
          });
          
          // Track color usage for debugging
          const key = `idx=${color.id} (${color.hex})`;
          colorUsage.set(key, (colorUsage.get(key) || 0) + 1);
        }
      }
    }

    // Debug: Log color distribution
    console.log('[PatPlacer] Color distribution in processed image:');
    for (const [color, count] of colorUsage.entries()) {
      console.log(`  ${color}: ${count} pixels`);
    }

    // Update UI
    const pixelCountEl = document.getElementById('patplacer-pixel-count');
    if (pixelCountEl) pixelCountEl.textContent = state.allPixels.length.toLocaleString();
    
    const totalPixelsEl = document.getElementById('patplacer-total-pixels');
    if (totalPixelsEl) totalPixelsEl.textContent = state.allPixels.length.toLocaleString();
    
    // Update info panel total
    const infoTotalEl = document.getElementById('patplacer-info-total');
    if (infoTotalEl) infoTotalEl.textContent = state.allPixels.length.toLocaleString();
    
    // Reset batch progress if image changes
    state.currentBatchIndex = 0;
    state.placedPixels = [];
    updateBatchUI();
    
    console.log(`[PatPlacer] Built pixel list: ${state.allPixels.length} pixels`);
  }
  
  /**
   * Find exact color match first, then fall back to closest
   */
  function findExactOrClosestColor(r, g, b) {
    // First try exact match
    for (const color of CONFIG.COLOR_PALETTE) {
      if (color.r === r && color.g === g && color.b === b) {
        return color;
      }
    }
    // Fall back to closest
    return findClosestColor(r, g, b);
  }

  /**
   * Fetch user's current charges from wplace API
   */
  async function fetchCharges() {
    try {
      const res = await fetch('https://backend.wplace.live/me', {
        credentials: 'include',
      });
      if (!res.ok) {
        state.currentCharges = 0;
        state.maxCharges = 1;
      } else {
        const data = await res.json();
        // Ensure charges are integers (floor to be safe)
        state.currentCharges = Math.floor(data.charges?.count ?? 0);
        state.maxCharges = Math.floor(data.charges?.max ?? 1);
      }
    } catch (e) {
      console.warn('[PatPlacer] Error fetching charges:', e);
      state.currentCharges = 0;
      state.maxCharges = 1;
    }

    // Update UI
    document.getElementById('patplacer-charges').textContent = state.currentCharges;
    document.getElementById('patplacer-max-charges').textContent = state.maxCharges;
    updatePlaceButtonState();
    
    console.log(`[PatPlacer] Charges: ${state.currentCharges}/${state.maxCharges}`);
  }

  /**
   * Update batch-related UI elements
   */
  function updateBatchUI() {
    const remaining = state.allPixels.length - state.currentBatchIndex;
    const btnTextEl = document.getElementById('patplacer-btn-text');
    
    // Update info panel progress
    const infoPlaced = document.getElementById('patplacer-info-placed');
    const infoTotal = document.getElementById('patplacer-info-total');
    const infoFill = document.getElementById('patplacer-info-progress-fill');
    
    if (infoPlaced) infoPlaced.textContent = state.currentBatchIndex.toLocaleString();
    if (infoTotal) infoTotal.textContent = state.allPixels.length.toLocaleString();
    if (infoFill && state.allPixels.length > 0) {
      const percent = (state.currentBatchIndex / state.allPixels.length) * 100;
      infoFill.style.width = `${percent}%`;
    }
    
    if (state.allPixels.length > 0) {
      if (state.currentBatchIndex === 0) {
        // First batch: subtract 2 for safety buffer
        const firstBatchSize = Math.floor(Math.min(Math.max(0, state.currentCharges - 2), remaining));
        btnTextEl.textContent = `Place Batch (${firstBatchSize} pixels)`;
      } else if (remaining > 0) {
        // Subsequent batches: also subtract 2 for safety buffer
        const nextBatchSize = Math.floor(Math.min(Math.max(0, state.currentCharges - 2), remaining));
        btnTextEl.textContent = `Place Next Batch (${nextBatchSize} pixels)`;
      } else {
        btnTextEl.textContent = '✓ Complete!';
      }
    } else {
      btnTextEl.textContent = 'Place Batch';
    }
  }

  // ============================================================
  // DRAFT CAPTURE (Anchor Point)
  // ============================================================
  function startDraftCapture() {
    if (state.draftListenerActive) {
      stopDraftCapture();
      return;
    }

    updateStatus('Waiting for draft placement...');
    document.getElementById('patplacer-capture-hint').style.display = 'block';
    document.getElementById('patplacer-capture-btn').innerHTML = `<img src="${CONFIG.ICON_BASE}target.png" class="pp-btn-icon" alt=""> Cancel Capture`;
    
    state.draftListenerActive = true;
    
    // Always set up a fresh hook for anchor capture
    // Clear previous Map reference - wplace may have recreated it after painting
    state.pixelDraftMap = null;
    state.originalMapSet = null;
    hookDraftMap();
  }

  function stopDraftCapture() {
    state.draftListenerActive = false;
    document.getElementById('patplacer-capture-hint').style.display = 'none';
    document.getElementById('patplacer-capture-btn').innerHTML = `<img src="${CONFIG.ICON_BASE}location.png" class="pp-btn-icon" alt=""> Capture Next Draft as Anchor`;
    // Don't unhook - let it auto-remove when draft is captured
    updateStatus('Draft capture cancelled');
  }

  function hookDraftMap() {
    // SAFE APPROACH: Temporary hook that auto-removes after finding the draft Map
    // This avoids permanent prototype pollution which could be detected by integrity checks
    //
    // From research: drafts stored in Map with key format "t=(tileX,tileY);p=(pixelX,pixelY);s=0"
    // Value format: {color: {r, g, b, a}, tile: [x, y], pixel: [x, y], season: 0, colorIdx: number}
    
    const DRAFT_KEY_PATTERN = /^t=\(\d+,\d+\);p=\(\d+,\d+\);s=\d+$/;
    
    // Already have a valid Map reference? No need to hook
    if (state.pixelDraftMap instanceof Map) {
      console.log('[PatPlacer] Draft Map already captured, skipping hook');
      return;
    }
    
    // Already hooked? Don't double-hook
    if (state.originalMapSet) {
      console.log('[PatPlacer] Hook already active');
      return;
    }
    
    // Store reference to the NATIVE Map.prototype.set before we override it
    const nativeMapSet = Map.prototype.set;
    state.originalMapSet = nativeMapSet;
    
    Map.prototype.set = function(key, value) {
      // Check if this is a pixel draft using regex pattern
      if (typeof key === 'string' && DRAFT_KEY_PATTERN.test(key)) {
        
        // Capture the Map reference
        state.pixelDraftMap = this;
        
        console.log('[PatPlacer] ✓ Draft Map captured!');
        console.log('[PatPlacer]   Key:', key);
        console.log('[PatPlacer]   Map size:', this.size);
        
        // IMMEDIATELY restore original Map.prototype.set - no ongoing pollution!
        Map.prototype.set = nativeMapSet;
        console.log('[PatPlacer] ✓ Map.prototype.set restored - no ongoing hook');
        
        // If we're actively listening for anchor, handle it
        if (state.draftListenerActive) {
          handleDraftDetected(key, value);
        }
      }
      
      // Call the native set function (captured in closure, not via prototype)
      return nativeMapSet.call(this, key, value);
    };
    
    console.log('[PatPlacer] Temporary Map.prototype.set hook active');
    console.log('[PatPlacer] Hook will auto-remove after capturing draft Map');
  }

  // Emergency cleanup - normally not needed since hook auto-removes
  function unhookDraftMap() {
    if (state.originalMapSet && Map.prototype.set !== state.originalMapSet) {
      Map.prototype.set = state.originalMapSet;
      state.originalMapSet = null;
      console.log('[PatPlacer] Map.prototype.set manually restored (emergency cleanup)');
    }
  }

  function handleDraftDetected(key, value) {
    // Parse the key: "t=(tileX,tileY);p=(pixelX,pixelY);s=0"
    const tileMatch = key.match(/t=\((\d+),(\d+)\)/);
    const pixelMatch = key.match(/p=\((\d+),(\d+)\)/);

    if (tileMatch && pixelMatch) {
      const tileX = parseInt(tileMatch[1]);
      const tileY = parseInt(tileMatch[2]);
      const pixelX = parseInt(pixelMatch[1]);
      const pixelY = parseInt(pixelMatch[2]);

      state.anchorTile = { x: tileX, y: tileY };
      state.anchorPixel = { x: pixelX, y: pixelY };
      state.anchorSet = true;

      // IMPORTANT: Learn the colorIdx mapping from wplace's own draft
      // This is the REAL colorIdx that wplace uses, so we should use this to correct our palette
      if (value.colorIdx !== undefined && value.color) {
        const realIdx = value.colorIdx;
        const realColor = value.color;
        console.log(`[PatPlacer] Learning color mapping: colorIdx=${realIdx} -> RGB(${realColor.r}, ${realColor.g}, ${realColor.b}) = ${rgbToHex(realColor.r, realColor.g, realColor.b)}`);
        
        // UPDATE our palette to match wplace's REAL colorIdx
        // Find if we have a color with similar RGB and fix its ID
        const existingIdx = CONFIG.COLOR_PALETTE.findIndex(c => 
          c.r === realColor.r && c.g === realColor.g && c.b === realColor.b
        );
        
        if (existingIdx !== -1) {
          const oldId = CONFIG.COLOR_PALETTE[existingIdx].id;
          if (oldId !== realIdx) {
            console.log(`[PatPlacer] FIXING palette: RGB(${realColor.r},${realColor.g},${realColor.b}) was idx ${oldId}, should be ${realIdx}`);
            CONFIG.COLOR_PALETTE[existingIdx].id = realIdx;
          }
        } else {
          // Color not in our palette - add it
          console.log(`[PatPlacer] ADDING to palette: idx ${realIdx} = RGB(${realColor.r},${realColor.g},${realColor.b})`);
          CONFIG.COLOR_PALETTE.push({
            id: realIdx,
            r: realColor.r,
            g: realColor.g,
            b: realColor.b,
            hex: rgbToHex(realColor.r, realColor.g, realColor.b)
          });
        }
      }

      // Update UI
      document.getElementById('patplacer-tile-pos').textContent = `(${tileX}, ${tileY})`;
      document.getElementById('patplacer-pixel-pos').textContent = `(${pixelX}, ${pixelY})`;
      
      // Show Move button now that anchor is set
      const moveBtn = document.getElementById('patplacer-move-btn');
      if (moveBtn) moveBtn.style.display = '';

      stopDraftCapture();
      
      // Check if anchor matches saved anchor (if we have one from a loaded save)
      if (state.savedAnchor) {
        const matches = checkAnchorMatchesSaved();
        if (matches) {
          updateStatus(`✓ Anchor set at saved position: tile (${tileX}, ${tileY}), pixel (${pixelX}, ${pixelY})`);
          hideSavedAnchorArrow();
        } else {
          // Anchor doesn't match - warn user but allow it
          const savedTile = state.savedAnchor.tile;
          const savedPixel = state.savedAnchor.pixel;
          updateStatus(`⚠️ Anchor differs from save! Current: (${tileX},${tileY})/(${pixelX},${pixelY}) | Saved: (${savedTile.x},${savedTile.y})/(${savedPixel.x},${savedPixel.y})`);
          // Keep arrow visible so user can see the saved position
        }
      } else {
        updateStatus(`Anchor set at tile (${tileX}, ${tileY}), pixel (${pixelX}, ${pixelY})`);
      }
      
      updatePlaceButtonState();

      // Auto-enable template overlay when anchor is set and image is loaded
      if (state.imageLoaded) {
        enableTemplateOverlay();
      }
    }
  }

  // ============================================================
  // PLACE BUTTON STATE
  // ============================================================
  function updatePlaceButtonState() {
    const btn = document.getElementById('patplacer-place-btn');
    const remaining = state.allPixels.length - state.currentBatchIndex;
    
    // Button enabled if: image loaded, anchor set, pixels remaining, has charges
    btn.disabled = !(state.imageLoaded && state.anchorSet && remaining > 0 && state.currentCharges > 0);
    
    updateBatchUI();
  }

  // ============================================================
  // DRAFT PLACEMENT - BATCH SYSTEM
  // ============================================================
  
  /**
   * Place the next batch of pixels based on available charges
   * Pre-scans to identify pixels that need placement vs already correct
   */
  async function placeNextBatch() {
    if (!state.imageLoaded || !state.anchorSet) {
      updateStatus('Error: Load image and set anchor first');
      return;
    }

    // Refresh charges first
    await fetchCharges();
    
    const remaining = state.allPixels.length - state.currentBatchIndex;
    if (remaining <= 0) {
      updateStatus('All pixels already placed!');
      return;
    }

    if (state.currentCharges <= 0) {
      updateStatus('No charges available. Wait for cooldown.');
      return;
    }

    // Check if we have a valid Map reference
    // For subsequent batches, we need to verify the Map is still valid
    if (state.currentBatchIndex > 0) {
      // After first batch was painted, wplace may have a new Map
      // Check if our Map reference still seems valid
      const draftMap = findDraftMap();
      if (!draftMap || draftMap.size > 0) {
        // Map has leftover entries - might be stale, or user didn't paint yet
        // This is actually OK - we can add to it
      }
      
      // If Map reference seems broken, warn user
      if (!draftMap) {
        updateStatus('Place one manual draft to sync, then try again.');
        return;
      }
    }

    if (state.isPlacing) {
      state.isPlacing = false;
      // Restore button icon
      const btn = document.getElementById('patplacer-place-btn');
      const btnIcon = btn.querySelector('.pp-btn-icon');
      if (btnIcon) btnIcon.style.display = '';
      updateBatchUI();
      updateStatus('Placement stopped');
      return;
    }

    state.isPlacing = true;

    const btn = document.getElementById('patplacer-place-btn');
    const btnTextEl = document.getElementById('patplacer-btn-text');
    const btnIcon = btn.querySelector('.pp-btn-icon');
    if (btnIcon) btnIcon.style.display = 'none';
    btnTextEl.textContent = '⏹ Stop';

    const progressEl = document.getElementById('patplacer-progress');
    if (progressEl) progressEl.style.display = 'block';

    // Calculate batch size based on charges
    // Safety margin: Always leave 2 charges unused to prevent 403s
    let availableCharges = Math.floor(Math.max(0, state.currentCharges - 2));
    
    // Check if we have any charges to use
    if (availableCharges <= 0) {
      state.isPlacing = false;
      if (state.currentBatchIndex === 0 && state.currentCharges <= 2) {
        updateStatus('Need at least 3 charges (1 for anchor + 2 buffer)');
      } else {
        updateStatus('Not enough charges (need at least 3)');
      }
      return;
    }

    // ============================================
    // PHASE 1: PRE-SCAN - Calculate batch with skip detection
    // ============================================
    updateStatus('Scanning pixels...');
    
    const batchStart = state.currentBatchIndex;
    const pixelsToPlace = [];  // Pixels that need to be placed
    const pixelsToSkip = [];   // Pixels already correct (will be marked as done)
    
    // Scan through remaining pixels until we have enough to place OR run out of pixels
    let scanIndex = batchStart;
    while (pixelsToPlace.length < availableCharges && scanIndex < state.allPixels.length) {
      const pixel = state.allPixels[scanIndex];
      
      if (isPixelAlreadyCorrect(pixel)) {
        pixelsToSkip.push({ index: scanIndex, pixel });
      } else {
        pixelsToPlace.push({ index: scanIndex, pixel });
      }
      scanIndex++;
    }
    
    const totalInBatch = pixelsToPlace.length + pixelsToSkip.length;
    const placedCount = pixelsToPlace.length;
    const skippedCount = pixelsToSkip.length;
    
    console.log(`[PatPlacer] Batch scan complete: ${placedCount} to place, ${skippedCount} to skip (already correct)`);
    
    // Check if there's anything to do
    if (totalInBatch <= 0) {
      state.isPlacing = false;
      updateStatus('No pixels to process in this range');
      return;
    }

    // ============================================
    // PHASE 2: PLACEMENT - Place the pixels that need it
    // ============================================
    updateStatus(`Placing ${placedCount} drafts (${skippedCount} already correct)...`);

    // Clear previous batch's placed pixels and prepare for new batch
    state.placedPixels = [];

    let processedCount = 0;
    
    // Process all pixels in order (both skip and place)
    for (let i = batchStart; i < scanIndex && state.isPlacing; i++) {
      const pixel = state.allPixels[i];
      const isSkipped = pixelsToSkip.some(s => s.index === i);
      
      if (!isSkipped) {
        // Actually place this pixel
        placeDraft(pixel);
        state.placedPixels.push(pixel);
      }
      
      processedCount++;

      // Update progress bar (batch placement progress, not overall)
      const percent = (processedCount / totalInBatch) * 100;
      const progressFillEl = document.getElementById('patplacer-progress-fill');
      const progressTextEl = document.getElementById('patplacer-progress-text');
      if (progressFillEl) progressFillEl.style.width = `${percent}%`;
      if (progressTextEl) {
        const placedSoFar = state.placedPixels.length;
        const skippedSoFar = processedCount - placedSoFar;
        if (skippedSoFar > 0) {
          progressTextEl.textContent = `Drafting: ${placedSoFar} placed, ${skippedSoFar} skipped`;
        } else {
          progressTextEl.textContent = `Drafting: ${placedSoFar} / ${placedCount}`;
        }
      }

      // Small delay to not overwhelm the browser
      if (processedCount % 100 === 0) {
        await sleep(10);
      }
    }
    
    // Store pending batch info - progress updates after user confirms
    state.pendingBatchCount = totalInBatch;
    state.pendingSkippedCount = skippedCount;

    // Trigger wplace UI to recognize the new drafts
    triggerDraftUIRefresh();
    
    // Debug: Log the Map state
    console.log(`[PatPlacer] Batch drafted. ${placedCount} drafts placed, ${skippedCount} skipped. Awaiting user confirmation.`);
    debugDraftMap();

    // NOTE: Don't auto-save here - save after user confirms

    state.isPlacing = false;
    if (progressEl) progressEl.style.display = 'none';
    
    // Restore button icon
    if (btnIcon) btnIcon.style.display = '';
    
    // Calculate remaining based on what WILL be after confirmation
    const pendingConfirmedIndex = state.currentBatchIndex + totalInBatch;
    const newRemaining = state.allPixels.length - pendingConfirmedIndex;
    
    if (newRemaining <= 0) {
      const skipMsg = skippedCount > 0 ? ` (${skippedCount} already correct)` : '';
      updateStatus(`✓ All ${state.allPixels.length} drafts placed${skipMsg}. Confirm on map to complete!`);
      btnTextEl.textContent = 'Awaiting Confirm';
      btn.disabled = true;
    } else {
      const skipMsg = skippedCount > 0 ? `, ${skippedCount} skipped` : '';
      updateStatus(`${placedCount} drafts placed${skipMsg}. Confirm on map to update progress.`);
    }

    // Update UI
    updateBatchUI();

    // Auto-switch to draft overlay after placement
    // Disable template overlay, enable draft overlay
    if (state.placedPixels.length > 0) {
      // Disable template overlay
      state.templateOverlayEnabled = false;
      
      // Enable draft overlay
      state.draftOverlayEnabled = true;
      state.overlayMode = 'draft';
      
      installFetchInterceptor();
      await processPlacedPixelsIntoChunks();
      setTimeout(triggerMapRefresh, 200);
      updateStatus(`Showing ${state.placedPixels.length} placed drafts. Confirm on map.`);
    }
    
    // Refresh charges after placing
    await fetchCharges();
  }

  function placeDraft(pixel) {
    // Calculate absolute position
    const absPixelX = state.anchorPixel.x + pixel.x;
    const absPixelY = state.anchorPixel.y + pixel.y;

    // Handle tile overflow
    const tileOffsetX = Math.floor(absPixelX / CONFIG.TILE_SIZE);
    const tileOffsetY = Math.floor(absPixelY / CONFIG.TILE_SIZE);
    
    const tileX = state.anchorTile.x + tileOffsetX;
    const tileY = state.anchorTile.y + tileOffsetY;
    
    const pixelX = ((absPixelX % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;
    const pixelY = ((absPixelY % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;

    // Create draft key and value - matching wplace format exactly
    // color must be {r, g, b, a} object, not hex string
    const key = `t=(${tileX},${tileY});p=(${pixelX},${pixelY});s=0`;
    const value = {
      color: { r: pixel.r, g: pixel.g, b: pixel.b, a: 255 },
      tile: [tileX, tileY],
      pixel: [pixelX, pixelY],
      season: 0,
      colorIdx: pixel.colorIdx
    };

    // Find wplace's pixel Map and add the draft
    try {
      const draftMap = findDraftMap();
      if (draftMap) {
        // Use Map.prototype.set directly on the captured Map
        // We use state.originalMapSet if available (it's the native Map.set)
        // This ensures we're using the real Map.set, not any hooked version
        const mapSet = state.originalMapSet || Map.prototype.set;
        mapSet.call(draftMap, key, value);
      } else {
        console.warn('[PatPlacer] No draft map found! Draw a pixel manually to capture the Map reference.');
      }
    } catch (error) {
      console.error('[PatPlacer] Error placing draft:', error);
    }
  }

  /**
   * After placing drafts, trigger wplace UI to refresh
   * This forces Svelte to re-render and recognize the new drafts
   */
  function triggerDraftUIRefresh() {
    try {
      // Method 1: Simulate a very small mouse move on the canvas
      // This often triggers Svelte's reactivity
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        canvas.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true,
          clientX: centerX,
          clientY: centerY
        }));
      }

      // Method 2: Try to trigger Svelte's invalidation by reassigning the Map
      // In Svelte, reactivity is triggered by assignment, not mutation
      // If we can find the component's state and reassign, it will trigger
      const draftMap = state.pixelDraftMap;
      if (draftMap) {
        // Create a shallow copy and trigger any possible observers
        // This is a hack - we clone the entries and recreate
        const entries = Array.from(draftMap.entries());
        const mapSet = state.originalMapSet || Map.prototype.set;
        draftMap.clear();
        for (const [k, v] of entries) {
          mapSet.call(draftMap, k, v);
        }
      }

      // Method 3: Force repaint by briefly changing canvas style
      if (canvas) {
        const originalOpacity = canvas.style.opacity;
        canvas.style.opacity = '0.999';
        requestAnimationFrame(() => {
          canvas.style.opacity = originalOpacity || '';
        });
      }

      // Method 4: Trigger a resize which often causes full re-render
      window.dispatchEvent(new Event('resize'));

    } catch (error) {
      console.warn('[PatPlacer] Could not trigger draft UI refresh:', error);
    }
  }

  function findDraftMap() {
    // Check if our captured Map is still valid
    if (state.pixelDraftMap instanceof Map) {
      // Verify Map is still usable (not been garbage collected or replaced)
      try {
        // Simple check - can we access size?
        const size = state.pixelDraftMap.size;
        console.log(`[PatPlacer] Using captured Map with ${size} entries`);
        return state.pixelDraftMap;
      } catch (e) {
        console.warn('[PatPlacer] Captured Map reference is stale, will re-capture');
        state.pixelDraftMap = null;
      }
    }
    
    // Map reference lost - need to re-hook to capture it again
    // This can happen if wplace recreates the Map after painting
    if (!state.pixelDraftMap) {
      console.log('[PatPlacer] No Map reference - setting up hook to recapture');
      // Clear the originalMapSet so hookDraftMap will set up a new hook
      if (state.originalMapSet && Map.prototype.set === state.originalMapSet) {
        // Hook was already restored, we can re-hook
        state.originalMapSet = null;
      }
      hookDraftMap();
    }
    
    // Fallback: try common locations (unlikely to work but worth trying)
    if (window.pixelDrafts instanceof Map) {
      console.log('[PatPlacer] Found window.pixelDrafts');
      state.pixelDraftMap = window.pixelDrafts;
      return window.pixelDrafts;
    }
    if (window.state?.pixelDrafts instanceof Map) {
      console.log('[PatPlacer] Found window.state.pixelDrafts');
      state.pixelDraftMap = window.state.pixelDrafts;
      return window.state.pixelDrafts;
    }
    
    // No valid Map found - user needs to place a manual draft to trigger our hook
    console.warn('[PatPlacer] No draft Map reference. Draw a pixel on the canvas to capture it.');
    return null;
  }

  /**
   * Debug: Log the current state of the draft Map
   */
  function debugDraftMap() {
    const draftMap = state.pixelDraftMap;
    if (!draftMap) {
      console.log('[PatPlacer Debug] No draft Map captured');
      return;
    }
    console.log(`[PatPlacer Debug] Draft Map has ${draftMap.size} entries:`);
    let count = 0;
    for (const [key, value] of draftMap) {
      if (count < 5) {
        console.log(`  ${key}:`, value);
      }
      count++;
    }
    if (count > 5) {
      console.log(`  ... and ${count - 5} more`);
    }
  }

  // ============================================================
  // OVERLAY - Tile Compositing Implementation
  // ============================================================
  
  let originalFetch = null;
  let fetchInterceptorInstalled = false;

  /**
   * Install fetch interceptor for tile overlay compositing AND paint request debugging
   */
  function installFetchInterceptor() {
    if (fetchInterceptorInstalled) return;
    
    originalFetch = window.fetch;
    fetchInterceptorInstalled = true;

    window.fetch = async function (...args) {
      const url = args[0] instanceof Request ? args[0].url : args[0];
      const options = args[1] || (args[0] instanceof Request ? {} : {});

      // DEBUG: Log paint requests to see what colors are being sent
      // Also disable draft overlay when user confirms/paints drafts
      if (typeof url === 'string' && url.includes('/pixel/') && options.method === 'POST') {
        try {
          const body = options.body;
          if (body) {
            const parsed = JSON.parse(body);
            console.log('[PatPlacer] PAINT REQUEST:', url);
            console.log('[PatPlacer] PAINT BODY:', parsed);
            if (parsed.colors) {
              console.log('[PatPlacer] Colors being sent:', parsed.colors);
            }
            
            // User confirmed drafts - disable draft overlay and clear placed pixels
            if (state.draftOverlayEnabled) {
              console.log('[PatPlacer] Drafts confirmed - disabling draft overlay');
              state.draftOverlayEnabled = false;
              
              // Update progress NOW that user has confirmed
              if (state.pendingBatchCount > 0) {
                state.currentBatchIndex += state.pendingBatchCount;
                
                // Update info panel progress (overall) - this is the real progress
                const overallPercent = (state.currentBatchIndex / state.allPixels.length) * 100;
                const infoFill = document.getElementById('patplacer-info-progress-fill');
                const infoPlaced = document.getElementById('patplacer-info-placed');
                if (infoFill) infoFill.style.width = `${overallPercent}%`;
                if (infoPlaced) infoPlaced.textContent = state.currentBatchIndex.toLocaleString();
                
                const confirmedCount = state.placedPixels.length;
                const skippedCount = state.pendingSkippedCount;
                const skipMsg = skippedCount > 0 ? ` (${skippedCount} skipped)` : '';
                console.log(`[PatPlacer] Confirmed ${confirmedCount} pixels${skipMsg}. Total progress: ${state.currentBatchIndex}/${state.allPixels.length}`);
                
                // Reset pending counts
                state.pendingBatchCount = 0;
                state.pendingSkippedCount = 0;
                
                // Update batch UI to reflect new progress
                updateBatchUI();
                
                // Re-enable button if there are more pixels to place
                const btn = document.getElementById('patplacer-batch-btn');
                const remaining = state.allPixels.length - state.currentBatchIndex;
                if (btn && remaining > 0) {
                  btn.disabled = false;
                } else if (btn && remaining <= 0) {
                  // Mark as complete
                  const btnTextEl = document.getElementById('patplacer-btn-text');
                  if (btnTextEl) btnTextEl.textContent = '✓ Complete!';
                  btn.disabled = true;
                }
                
                // Auto-save progress after confirmation
                PatPlacerStorage.saveToLocal();
              }
              
              state.placedPixels = [];
              state.chunkedTiles.clear();
              setTimeout(triggerMapRefresh, 500);
              // Auto-refresh charges after paint completes
              setTimeout(() => {
                console.log('[PatPlacer] Auto-refreshing charges after paint');
                fetchCharges();
              }, 1000);
              updateStatus('Drafts confirmed! Progress updated. Refreshing charges...');
            }
          }
        } catch (e) {
          console.log('[PatPlacer] Could not parse paint request body');
        }
      }

      // Call original fetch
      const response = await originalFetch.apply(this, args);

      // Intercept PNG tile responses
      // 1. Cache original tile data for skip-correct-pixels feature (always)
      // 2. Apply overlay if enabled
      if (typeof url === 'string') {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('image/png') && url.includes('.png')) {
          // Check if this is a wplace tile (pattern: /tileX/tileY.png)
          const tileMatch = url.match(/\/(\d+)\/(\d+)\.png/);
          if (tileMatch) {
            const tileX = parseInt(tileMatch[1], 10);
            const tileY = parseInt(tileMatch[2], 10);
            const tileKey = `${tileX},${tileY}`;

            // Clone the response to get original tile data
            const cloned = response.clone();
            const originalBlob = await cloned.blob();
            
            // Cache original tile ImageData for skip-correct-pixels feature
            try {
              const bitmap = await createImageBitmap(originalBlob);
              const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
              const ctx = canvas.getContext('2d');
              ctx.drawImage(bitmap, 0, 0);
              const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
              state.originalTilesData.set(tileKey, imageData);
              bitmap.close();
            } catch (e) {
              console.warn('[PatPlacer] Error caching tile data:', tileKey, e);
            }
            
            // Apply overlay if enabled
            const overlayActive = state.templateOverlayEnabled || state.draftOverlayEnabled;
            const anchorMarker = getAnchorMarkerForTile(tileKey);
            
            if (overlayActive || anchorMarker) {
              try {
                let currentBlob = originalBlob;
                
                // First apply template/draft overlay if enabled
                if (overlayActive) {
                  const chunkBitmap = state.chunkedTiles.get(tileKey);
                  if (chunkBitmap) {
                    const opacity = state.overlayMode === 'draft' ? state.draftOverlayOpacity : state.templateOverlayOpacity;
                    currentBlob = await compositeTile(currentBlob, chunkBitmap, opacity);
                  }
                }
                
                // Then apply anchor marker overlay on top (always full opacity)
                if (anchorMarker) {
                  currentBlob = await compositeTile(currentBlob, anchorMarker, 1.0);
                }
                
                return new Response(currentBlob, {
                  headers: response.headers,
                  status: response.status,
                  statusText: response.statusText,
                });
              } catch (e) {
                console.error('[PatPlacer] Error compositing overlay:', e);
              }
            }
          }
        }
      }

      return response;
    };

    console.log('[PatPlacer] Fetch interceptor installed for overlay');
  }

  /**
   * Composite overlay chunk onto original tile
   * @param {Blob} originalBlob - The original tile blob
   * @param {ImageBitmap} overlayBitmap - The overlay bitmap
   * @param {number} opacity - Opacity value between 0 and 1
   */
  async function compositeTile(originalBlob, overlayBitmap, opacity = 1.0) {
    const originalBitmap = await createImageBitmap(originalBlob);
    
    const canvas = new OffscreenCanvas(originalBitmap.width, originalBitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Draw original tile
    ctx.drawImage(originalBitmap, 0, 0);

    // Apply overlay with opacity
    ctx.globalAlpha = opacity;
    ctx.drawImage(overlayBitmap, 0, 0);
    ctx.globalAlpha = 1.0;

    // Convert back to blob
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob;
  }

  /**
   * Calculate which tiles the image spans
   */
  function calculateTileRange() {
    if (!state.anchorSet || !state.imageLoaded) return null;

    const startTileX = state.anchorTile.x;
    const startTileY = state.anchorTile.y;
    const startPixelX = state.anchorPixel.x;
    const startPixelY = state.anchorPixel.y;

    // Calculate end position
    const endPixelX = startPixelX + state.imageWidth - 1;
    const endPixelY = startPixelY + state.imageHeight - 1;

    const endTileX = startTileX + Math.floor(endPixelX / CONFIG.TILE_SIZE);
    const endTileY = startTileY + Math.floor(endPixelY / CONFIG.TILE_SIZE);

    return { startTileX, startTileY, endTileX, endTileY };
  }

  /**
   * Process a single tile for overlay
   * Uses state.allPixels (palette-mapped colors) instead of raw imageBitmap
   */
  async function processTileChunk(tx, ty) {
    if (!state.allPixels || state.allPixels.length === 0 || !state.anchorSet) return null;

    // Group pixels that belong to this tile
    const tilePixels = [];
    
    for (const pixel of state.allPixels) {
      // Calculate absolute pixel position
      const absPixelX = state.anchorPixel.x + pixel.x;
      const absPixelY = state.anchorPixel.y + pixel.y;

      // Calculate which tile this pixel belongs to
      const tileOffsetX = Math.floor(absPixelX / CONFIG.TILE_SIZE);
      const tileOffsetY = Math.floor(absPixelY / CONFIG.TILE_SIZE);
      
      const pixelTileX = state.anchorTile.x + tileOffsetX;
      const pixelTileY = state.anchorTile.y + tileOffsetY;
      
      // Only include pixels for this tile
      if (pixelTileX === tx && pixelTileY === ty) {
        // Calculate position within tile
        const pixelX = ((absPixelX % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;
        const pixelY = ((absPixelY % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;
        
        tilePixels.push({
          x: pixelX,
          y: pixelY,
          r: pixel.r,
          g: pixel.g,
          b: pixel.b
        });
      }
    }
    
    if (tilePixels.length === 0) return null;

    // Draw pixels onto chunk canvas
    const chunkCanvas = new OffscreenCanvas(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
    const chunkCtx = chunkCanvas.getContext('2d');
    chunkCtx.imageSmoothingEnabled = false;

    for (const pixel of tilePixels) {
      chunkCtx.fillStyle = `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`;
      chunkCtx.fillRect(pixel.x, pixel.y, 1, 1);
    }

    return chunkCanvas.transferToImageBitmap();
  }

  /**
   * Process image into overlay tile chunks
   */
  async function processImageIntoChunks() {
    if (!state.imageBitmap || !state.anchorSet) {
      console.warn('[PatPlacer] Cannot process chunks - missing image or anchor');
      return;
    }

    console.log('[PatPlacer] Processing image into overlay chunks...');
    state.chunkedTiles.clear();

    const tileRange = calculateTileRange();
    if (!tileRange) return;

    const { startTileX, startTileY, endTileX, endTileY } = tileRange;
    const totalTiles = (endTileX - startTileX + 1) * (endTileY - startTileY + 1);
    console.log(`[PatPlacer] Processing ${totalTiles} overlay tiles...`);

    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        const tileKey = `${tx},${ty}`;
        const chunkBitmap = await processTileChunk(tx, ty);
        if (chunkBitmap) {
          state.chunkedTiles.set(tileKey, chunkBitmap);
        }
      }
    }

    console.log(`[PatPlacer] Overlay processed: ${state.chunkedTiles.size} tiles created`);
  }

  /**
   * Process ONLY the placed pixels into overlay chunks (for batch system)
   * This creates an overlay showing just the drafts that were placed
   */
  async function processPlacedPixelsIntoChunks() {
    if (!state.anchorSet || state.placedPixels.length === 0) {
      console.warn('[PatPlacer] Cannot process placed pixels - no anchor or no pixels');
      return;
    }

    console.log(`[PatPlacer] Processing ${state.placedPixels.length} placed pixels into overlay...`);
    state.chunkedTiles.clear();

    // Group pixels by tile
    const pixelsByTile = new Map();
    
    for (const pixel of state.placedPixels) {
      const absPixelX = state.anchorPixel.x + pixel.x;
      const absPixelY = state.anchorPixel.y + pixel.y;

      const tileOffsetX = Math.floor(absPixelX / CONFIG.TILE_SIZE);
      const tileOffsetY = Math.floor(absPixelY / CONFIG.TILE_SIZE);
      
      const tileX = state.anchorTile.x + tileOffsetX;
      const tileY = state.anchorTile.y + tileOffsetY;
      
      const pixelX = ((absPixelX % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;
      const pixelY = ((absPixelY % CONFIG.TILE_SIZE) + CONFIG.TILE_SIZE) % CONFIG.TILE_SIZE;

      const tileKey = `${tileX},${tileY}`;
      if (!pixelsByTile.has(tileKey)) {
        pixelsByTile.set(tileKey, []);
      }
      pixelsByTile.get(tileKey).push({ x: pixelX, y: pixelY, r: pixel.r, g: pixel.g, b: pixel.b });
    }

    // Process each tile
    for (const [tileKey, pixels] of pixelsByTile) {
      const chunkBitmap = await processPlacedPixelsTile(pixels);
      if (chunkBitmap) {
        state.chunkedTiles.set(tileKey, chunkBitmap);
      }
    }

    console.log(`[PatPlacer] Placed pixels overlay: ${state.chunkedTiles.size} tiles created`);
  }

  /**
   * Process a single tile containing placed pixels
   */
  async function processPlacedPixelsTile(pixels) {
    // Draw 1:1 pixels
    const chunkCanvas = new OffscreenCanvas(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
    const chunkCtx = chunkCanvas.getContext('2d');
    chunkCtx.imageSmoothingEnabled = false;

    for (const pixel of pixels) {
      chunkCtx.fillStyle = `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`;
      chunkCtx.fillRect(pixel.x, pixel.y, 1, 1);
    }

    return chunkCanvas.transferToImageBitmap();
  }

  /**
   * Trigger map to refresh tiles
   */
  function triggerMapRefresh() {
    try {
      // Method 1: Dispatch wheel event to trigger tile reload
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const wheelEvent = new WheelEvent('wheel', {
          deltaY: 1,
          deltaMode: 0,
          bubbles: true,
          cancelable: true,
          view: window
        });
        canvas.dispatchEvent(wheelEvent);

        // Immediately counter it
        setTimeout(() => {
          const counterEvent = new WheelEvent('wheel', {
            deltaY: -1,
            deltaMode: 0,
            bubbles: true,
            cancelable: true,
            view: window
          });
          canvas.dispatchEvent(counterEvent);
        }, 50);
      }

      // Method 2: Trigger resize event
      window.dispatchEvent(new Event('resize'));
    } catch (error) {
      console.warn('[PatPlacer] Could not trigger map refresh:', error);
    }
  }

  // Enable template overlay (full image preview)
  function enableTemplateOverlay() {
    if (!state.imageLoaded || !state.anchorSet) {
      updateStatus('Load image and set anchor first');
      return;
    }

    state.templateOverlayEnabled = true;
    state.overlayMode = 'template';
    
    installFetchInterceptor();
    
    processImageIntoChunks().then(() => {
      setTimeout(triggerMapRefresh, 200);
      updateStatus('Template overlay enabled');
    });
  }

  // Enable draft overlay (shows placed drafts only)
  function enableDraftOverlay() {
    if (!state.anchorSet || state.placedPixels.length === 0) {
      updateStatus('No drafts placed yet');
      return;
    }

    state.draftOverlayEnabled = true;
    state.overlayMode = 'draft';
    
    installFetchInterceptor();
    
    processPlacedPixelsIntoChunks().then(() => {
      setTimeout(triggerMapRefresh, 200);
      updateStatus('Draft overlay ON - showing ' + state.placedPixels.length + ' drafts');
    });
  }

  function disableOverlay() {
    state.templateOverlayEnabled = false;
    state.draftOverlayEnabled = false;
    state.chunkedTiles.clear();
    // Trigger refresh to show original tiles
    setTimeout(triggerMapRefresh, 100);
    updateStatus('Overlay disabled');
  }

  function refreshOverlay() {
    if (state.templateOverlayEnabled) {
      processImageIntoChunks().then(() => {
        setTimeout(triggerMapRefresh, 200);
        updateStatus('Template overlay refreshed');
      });
    } else if (state.draftOverlayEnabled) {
      processPlacedPixelsIntoChunks().then(() => {
        setTimeout(triggerMapRefresh, 200);
        updateStatus('Draft overlay refreshed');
      });
    }
  }

  // ============================================================
  // SAVED ANCHOR ARROW OVERLAY (Map-based marker)
  // ============================================================
  
  // Separate chunked tiles for the anchor marker overlay
  let anchorMarkerTiles = new Map();
  let anchorMarkerEnabled = false;
  
  /**
   * Show a marker on the map at the saved anchor position.
   * This draws directly onto the map tiles like the template overlay.
   */
  function showSavedAnchorArrow() {
    if (!state.savedAnchor) return;
    
    anchorMarkerEnabled = true;
    
    // Generate the marker tile overlay
    generateAnchorMarkerTiles();
    
    // Install fetch interceptor if not already
    installFetchInterceptor();
    
    // Trigger map refresh to show the marker
    setTimeout(triggerMapRefresh, 200);
    
    console.log(`[PatPlacer] Showing anchor marker at tile(${state.savedAnchor.tile.x}, ${state.savedAnchor.tile.y}), pixel(${state.savedAnchor.pixel.x}, ${state.savedAnchor.pixel.y})`);
    
    // Also show a dismissible info panel
    showAnchorInfoPanel();
  }
  
  /**
   * Generate tile chunks for the anchor marker (a visible marker around the saved anchor point)
   */
  function generateAnchorMarkerTiles() {
    anchorMarkerTiles.clear();
    
    if (!state.savedAnchor) return;
    
    const { tile, pixel } = state.savedAnchor;
    const tileKey = `${tile.x},${tile.y}`;
    
    // Create a marker bitmap for this tile
    const markerCanvas = new OffscreenCanvas(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
    const ctx = markerCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    
    // Draw a prominent marker at the anchor pixel position
    const px = pixel.x;
    const py = pixel.y;
    
    // Draw crosshair/target marker
    const markerColor = '#FFD700'; // Gold
    const centerColor = '#FF0000'; // Red center
    const outlineColor = '#000000'; // Black outline
    const markerSize = 7; // Size of the marker arms
    
    // Draw black outline first (larger)
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 3;
    
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(px + 0.5, Math.max(0, py - markerSize));
    ctx.lineTo(px + 0.5, Math.min(CONFIG.TILE_SIZE, py + markerSize + 1));
    ctx.stroke();
    
    // Horizontal line  
    ctx.beginPath();
    ctx.moveTo(Math.max(0, px - markerSize), py + 0.5);
    ctx.lineTo(Math.min(CONFIG.TILE_SIZE, px + markerSize + 1), py + 0.5);
    ctx.stroke();
    
    // Draw gold crosshair on top
    ctx.strokeStyle = markerColor;
    ctx.lineWidth = 1;
    
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(px + 0.5, Math.max(0, py - markerSize));
    ctx.lineTo(px + 0.5, Math.min(CONFIG.TILE_SIZE, py + markerSize + 1));
    ctx.stroke();
    
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(Math.max(0, px - markerSize), py + 0.5);
    ctx.lineTo(Math.min(CONFIG.TILE_SIZE, px + markerSize + 1), py + 0.5);
    ctx.stroke();
    
    // Draw RED center pixel
    ctx.fillStyle = centerColor;
    ctx.fillRect(px, py, 1, 1);
    
    // Draw corner brackets for visibility
    ctx.strokeStyle = markerColor;
    ctx.lineWidth = 2;
    const bracketSize = 4;
    const bracketOffset = 3;
    
    // Top-left bracket
    ctx.beginPath();
    ctx.moveTo(px - bracketOffset - bracketSize, py - bracketOffset);
    ctx.lineTo(px - bracketOffset, py - bracketOffset);
    ctx.lineTo(px - bracketOffset, py - bracketOffset - bracketSize);
    ctx.stroke();
    
    // Top-right bracket
    ctx.beginPath();
    ctx.moveTo(px + bracketOffset + bracketSize + 1, py - bracketOffset);
    ctx.lineTo(px + bracketOffset + 1, py - bracketOffset);
    ctx.lineTo(px + bracketOffset + 1, py - bracketOffset - bracketSize);
    ctx.stroke();
    
    // Bottom-left bracket
    ctx.beginPath();
    ctx.moveTo(px - bracketOffset - bracketSize, py + bracketOffset + 1);
    ctx.lineTo(px - bracketOffset, py + bracketOffset + 1);
    ctx.lineTo(px - bracketOffset, py + bracketOffset + bracketSize + 1);
    ctx.stroke();
    
    // Bottom-right bracket
    ctx.beginPath();
    ctx.moveTo(px + bracketOffset + bracketSize + 1, py + bracketOffset + 1);
    ctx.lineTo(px + bracketOffset + 1, py + bracketOffset + 1);
    ctx.lineTo(px + bracketOffset + 1, py + bracketOffset + bracketSize + 1);
    ctx.stroke();
    
    // Draw a pulsing ring (outer)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + 0.5, py + 0.5, 10, 0, Math.PI * 2);
    ctx.stroke();
    
    // Store the marker bitmap
    anchorMarkerTiles.set(tileKey, markerCanvas.transferToImageBitmap());
    
    console.log(`[PatPlacer] Generated anchor marker tile: ${tileKey}`);
  }
  
  /**
   * Show info panel about the saved anchor (DOM element for dismissing)
   */
  function showAnchorInfoPanel() {
    // Remove existing panel
    hideAnchorInfoPanel();
    
    const panel = document.createElement('div');
    panel.id = 'patplacer-anchor-info';
    panel.className = 'pp-anchor-arrow';
    
    panel.innerHTML = `
      <div class="pp-arrow-content">
        <div class="pp-arrow-pointer">⊕</div>
        <div class="pp-arrow-info">
          <div class="pp-arrow-label">SAVED ANCHOR POSITION</div>
          <div class="pp-arrow-coords">
            Tile: (${state.savedAnchor.tile.x}, ${state.savedAnchor.tile.y})<br>
            Pixel: (${state.savedAnchor.pixel.x}, ${state.savedAnchor.pixel.y})
          </div>
          <div class="pp-arrow-hint">Navigate to marker on map</div>
        </div>
        <button class="pp-arrow-dismiss" id="pp-anchor-dismiss" title="Dismiss marker">✕</button>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    // Position it at top-right of viewport
    panel.style.position = 'fixed';
    panel.style.top = '80px';
    panel.style.right = '20px';
    
    document.getElementById('pp-anchor-dismiss').addEventListener('click', () => {
      hideSavedAnchorArrow();
      updateStatus('Anchor marker dismissed');
    });
  }
  
  function hideAnchorInfoPanel() {
    const panel = document.getElementById('patplacer-anchor-info');
    if (panel) panel.remove();
  }
  
  /**
   * Hide the saved anchor arrow overlay
   */
  function hideSavedAnchorArrow() {
    anchorMarkerEnabled = false;
    anchorMarkerTiles.clear();
    hideAnchorInfoPanel();
    setTimeout(triggerMapRefresh, 100);
  }
  
  /**
   * Get anchor marker bitmap for a specific tile (called from fetch interceptor)
   */
  function getAnchorMarkerForTile(tileKey) {
    if (!anchorMarkerEnabled) return null;
    return anchorMarkerTiles.get(tileKey);
  }
  
  /**
   * Check if current anchor matches saved anchor position
   */
  function checkAnchorMatchesSaved() {
    if (!state.savedAnchor || !state.anchorSet) return false;
    
    return state.anchorTile.x === state.savedAnchor.tile.x &&
           state.anchorTile.y === state.savedAnchor.tile.y &&
           state.anchorPixel.x === state.savedAnchor.pixel.x &&
           state.anchorPixel.y === state.savedAnchor.pixel.y;
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================
  // MESSAGE HANDLING
  // ============================================================
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'patplacer-content') {
      switch (event.data.action) {
        case 'togglePanel':
          togglePanel();
          break;
      }
    }
  });

  // ============================================================
  // INITIALIZATION
  // ============================================================
  async function init() {
    // SAFE APPROACH: Hook Map.prototype.set temporarily to capture the draft Map reference
    // The hook AUTO-REMOVES itself after finding the Map - no permanent prototype pollution!
    // This makes PatPlacer much safer against wplace's potential code integrity checks
    hookDraftMap();
    
    // Don't extract palette yet - wait for user to open color picker
    // This ensures we only use colors available to THIS user
    // extractColorPalette();
    
    // Initialize image processor - wait a moment for it to be available
    await initImageProcessor();
    
    createPanel();
    showPanel();
    
    // Setup observer to capture colors when user opens palette
    setupColorPaletteObserver();
    
    // Fetch charges on startup
    await fetchCharges();

    // Check for autosave
    if (PatPlacerStorage.hasAutosave()) {
      const autosaveRow = document.getElementById('patplacer-autosave-row');
      if (autosaveRow) {
        autosaveRow.style.display = 'block';
      }
    }
    
    console.log('[PatPlacer] Initialized successfully');
    console.log('[PatPlacer] Open the color picker to capture available colors');
    updateStatus('Open wplace color picker to capture available colors');
  }

  // Expose API
  window.PatPlacer = {
    togglePanel,
    showPanel,
    hidePanel,
    state,
    fetchCharges // Expose for manual refresh
  };

  // Start
  init();

})();

