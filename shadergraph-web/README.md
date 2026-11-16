# ShaderGraph Studio (`shadergraph-web`)

Browser-based visual shader editor for creating, editing, previewing, and exporting **Unity Shader Graphs** (`.shadergraph` SGVersion 3 and standalone URP `.shader` HLSL files).

**Live App:** [https://smileywiley.github.io/shadergraph-studio/](https://smileywiley.github.io/shadergraph-studio/)

## Quick Start

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` — Start the Vite development server
- `npm run build` — Run `tsc -b` type-checking and build the production bundle into `dist/`
- `npm run lint` — Lint with `oxlint`
- `npm run preview` — Serve the production `dist/` bundle locally

## Key Modules

- `src/nodes/nodeRegistry.ts` — 48 core Unity Shader Graph node definitions across Input, Math, Procedural, UV, Channel, Artistic, and Utility.
- `src/compiler/shaderCompiler.ts` — Graph topological sorting, dynamic vector port resolution, WebGL GLSL compiler, and Unity URP ShaderLab/HLSL compiler.
- `src/compiler/unityShaderGraphIO.ts` — Native Unity `.shadergraph` (SGVersion 3 multi-JSON) exporter and importer.
- `src/components/GraphCanvas.tsx` — Touch- and mouse-friendly node canvas with Bezier wires, tap-to-connect, resizable/auto-shifting groups, and sticky notes.
- `src/components/MainPreview3D.tsx` & `src/components/NodeInlinePreview.tsx` — Three.js 3D viewport and shared-context 2D inline node previews.
- `src/components/DiagnosticsModal.tsx` & `src/utils/diagnosticsStore.ts` — WebGL shader compilation validator, GPU info, and error log modal.
