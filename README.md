# StickerCut PRO — Print & Cut Sheet Production Studio

A high-performance, cross-platform desktop & web production application for print-and-cut sticker production, true-shape nesting, vector prepress automation, and Graphtec Cutting Master 5 integration.

---

## 🚀 Key Features

- **True-Shape Nesting & Packing**: Automatic sheet nesting with configurable spacing, bleed, and sheet utilization reporting.
- **Pre-flight Vector & Bleed Audits**: Automated DPI rating, vector path integrity checks, and snag-free closed cut contour tracing.
- **Graphtec Cutting Master 5 Layer Hierarchy**: 1:1 scale exports with dedicated OCG layers (`Folder_Cut_Line`, `Folder_Background_Image`, `Registration Marks`).
- **Prepress Asset Separation**: Export synchronized `_PRINT.pdf` (300 DPI sRGB/CMYK) and `_CUT.svg` files for separate print and cut workflows.
- **Cross-Platform Native Desktop**: Built with **Tauri v2** + **Rust** supporting Windows (`.exe`), macOS (`.dmg`), and Linux (`.AppImage`).
- **Cloud Sync & Firebase Authentication**: Secure email/password login and cloud project backup via Cloud Firestore.
- **Local Persistence**: Save and restore `.stickerproj` state directly from native OS dialogs.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS / Tailwind
- **Desktop Runtime**: Tauri v2, Rust
- **Geometry & Rendering**: Paper.js, jsPDF
- **Cloud & Auth**: Firebase Auth, Cloud Firestore, Cloudinary CDN

---

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (for desktop builds)

### Installation

```bash
# Install dependencies
npm install

# Start local web development server
npm run dev

# Run desktop application in development mode
npm run tauri dev
```

### Production Build

```bash
# Build web frontend
npm run build

# Build native desktop installer & executable
npm run tauri build
```

---

## 📄 License

Proprietary — All rights reserved.
