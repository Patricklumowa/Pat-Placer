<p align="center">
  <img src="extension/icons/dragon.png" alt="PatPlacer Dragon" width="80" height="80" style="image-rendering: pixelated;">
</p>

<h1 align="center">🎮 PatPlacer</h1>

<p align="center">
  <strong>A precision pixel art placement tool for wplace.live</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0-8338ec?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/platform-Chrome-00d9ff?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/pixels-∞-ff006e?style=flat-square" alt="Pixels">
</p>

---

## ⚔️ What is PatPlacer?

PatPlacer is a Chrome extension designed for artists and communities who want to place pixel art on [wplace.live](https://wplace.live) with surgical precision. Whether you're defending territory, collaborating on massive murals, or just want your art placed *exactly* where you want it—PatPlacer has your back.

**This is not a bot.** PatPlacer is a template overlay and batch drafting tool that helps you visualize and queue pixel placements efficiently.

---

## ✨ Features

### 🖼️ Advanced Image Processing
- **Smart Resizing** — Nearest neighbor, bilinear, bicubic, and Lanczos resampling
- **Color Correction** — Brightness, contrast, saturation, hue, and gamma controls
- **Dithering Algorithms** — Floyd-Steinberg, Atkinson, Ordered (Bayer), and more
- **Edge Detection** — Sobel, Prewitt, and Roberts cross operators
- **Post-Processing** — Posterize, mode filter, simplify, and erosion

### 🎯 Precision Placement
- **Anchor System** — Click anywhere on the canvas to set your placement origin
- **Template Overlay** — See exactly where your art will go before placing
- **Draft Overlay** — Visualize queued pixels in real-time
- **Tile-Accurate Positioning** — Works with wplace's tile coordinate system

### ⚡ Batch Operations
- **Smart Batching** — Queue hundreds of pixels at once
- **Progress Tracking** — Real-time stats on placed vs. remaining pixels
- **Auto-Save** — Never lose your progress with automatic local storage backup
- **Import/Export** — Save and share your projects as JSON files

### 🎨 Retro Cyberpunk UI
- **Pixel-Perfect Design** — Custom pixel art icons and decorations
- **Floating Characters** — Dragon, wizard, alien, and more watching over your work
- **Info Panel** — Live preview, stats, and progress at a glance

---

## 🚀 Installation

### From Source (Developer Mode)

1. **Clone or Download** this repository
   ```bash
   git clone https://github.com/yourusername/PatPlacer.git
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right)

3. **Load the Extension**
   - Click **Load unpacked**
   - Select the `extension` folder from this repo

4. **Navigate to wplace.live**
   - The PatPlacer panel will appear automatically
   - Or click the extension icon to toggle

---

## 📖 Usage Guide

### Quick Start

1. **Upload an Image** — Drag & drop or click to browse
2. **Process** — Open the processing panel to resize, dither, and optimize
3. **Set Anchor** — Click "Capture Anchor" then click your target location on the canvas
4. **Preview** — Toggle template overlay to see placement preview
5. **Place** — Click "Place Drafts" to queue your pixels

### Processing Pipeline

```
Original Image
     ↓
Color Corrections (brightness, contrast, saturation, hue, gamma)
     ↓
Blur/Sharpen (optional)
     ↓
Resize (with chosen resampling method)
     ↓
Edge Detection (optional)
     ↓
Post-Processing (posterize, mode filter, simplify, erode)
     ↓
Quantization/Dithering (map to wplace palette)
     ↓
Ready to Place!
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Drag Header` | Move panel |
| `Scroll on Preview` | Zoom in/out |
| `Click Fit` | Auto-fit preview to window |

---

## 🏗️ Project Structure

```
PatPlacer/
├── extension/
│   ├── manifest.json          # Chrome extension manifest (v3)
│   ├── background.js          # Service worker
│   ├── content-script.js      # Injection bootstrapper
│   ├── icons/                 # Pixel art icons (32x32)
│   ├── popup/                 # Extension popup UI
│   ├── scripts/
│   │   └── patplacer-main.js  # Core application logic
│   └── styles/
│       └── patplacer.css      # Retro cyberpunk styling
└── src/                       # Research & development scripts
```

---

## 🎨 Color Palette

PatPlacer uses wplace.live's official 32-color palette:

| | | | | | | | |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ![#be0039](https://via.placeholder.com/20/be0039/be0039) | ![#ff4500](https://via.placeholder.com/20/ff4500/ff4500) | ![#ffa800](https://via.placeholder.com/20/ffa800/ffa800) | ![#ffd635](https://via.placeholder.com/20/ffd635/ffd635) | ![#00a368](https://via.placeholder.com/20/00a368/00a368) | ![#00cc78](https://via.placeholder.com/20/00cc78/00cc78) | ![#7eed56](https://via.placeholder.com/20/7eed56/7eed56) | ![#00756f](https://via.placeholder.com/20/00756f/00756f) |
| ![#009eaa](https://via.placeholder.com/20/009eaa/009eaa) | ![#2450a4](https://via.placeholder.com/20/2450a4/2450a4) | ![#3690ea](https://via.placeholder.com/20/3690ea/3690ea) | ![#51e9f4](https://via.placeholder.com/20/51e9f4/51e9f4) | ![#493ac1](https://via.placeholder.com/20/493ac1/493ac1) | ![#6a5cff](https://via.placeholder.com/20/6a5cff/6a5cff) | ![#811e9f](https://via.placeholder.com/20/811e9f/811e9f) | ![#b44ac0](https://via.placeholder.com/20/b44ac0/b44ac0) |
| ![#ff3881](https://via.placeholder.com/20/ff3881/ff3881) | ![#ff99aa](https://via.placeholder.com/20/ff99aa/ff99aa) | ![#6d482f](https://via.placeholder.com/20/6d482f/6d482f) | ![#9c6926](https://via.placeholder.com/20/9c6926/9c6926) | ![#ffb470](https://via.placeholder.com/20/ffb470/ffb470) | ![#000000](https://via.placeholder.com/20/000000/000000) | ![#515252](https://via.placeholder.com/20/515252/515252) | ![#898d90](https://via.placeholder.com/20/898d90/898d90) |
| ![#d4d7d9](https://via.placeholder.com/20/d4d7d9/d4d7d9) | ![#ffffff](https://via.placeholder.com/20/ffffff/ffffff) | | | | | | |

---

## 🔧 Technical Details

### Color Matching Algorithms

- **Euclidean RGB** — Fast, good for most images
- **Weighted RGB** — Human perception weighted
- **CIE76 (LAB)** — Perceptually uniform color space
- **CIEDE2000** — Most accurate, slightly slower

### Dithering Methods

| Method | Best For |
|--------|----------|
| Floyd-Steinberg | Photographs, gradients |
| Atkinson | High contrast, pixel art |
| Ordered (Bayer) | Retro aesthetics, patterns |
| Sierra | Smooth gradients |
| Stucki | Detailed images |

---

## ⚠️ Disclaimer

PatPlacer is a **visualization and drafting tool**. It does not bypass any rate limits or automate actual pixel placement beyond what the wplace.live interface allows. Use responsibly and respect community guidelines.

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs via Issues
- Submit feature requests
- Open Pull Requests

---

## 📜 License

MIT License — Do whatever you want, just don't blame us if your pixels get overwritten.

---

<p align="center">
  <sub>Built with 💜 and way too much caffeine</sub>
</p>

<p align="center">
  <img src="extension/icons/wizard.png" width="32" style="image-rendering: pixelated;">
  <img src="extension/icons/alien.png" width="32" style="image-rendering: pixelated;">
  <img src="extension/icons/girl.png" width="32" style="image-rendering: pixelated;">
  <img src="extension/icons/robot.png" width="32" style="image-rendering: pixelated;">
  <img src="extension/icons/monster.png" width="32" style="image-rendering: pixelated;">
</p>
