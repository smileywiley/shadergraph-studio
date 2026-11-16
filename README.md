# ShaderGraph Studio

A browser-based visual shader editor for creating, editing, previewing, and exporting **Unity Shader Graphs** (`.shadergraph` and standalone URP `.shader` HLSL files) on desktop and mobile devices.

**Live App:** [https://smileywiley.github.io/shadergraph-studio/](https://smileywiley.github.io/shadergraph-studio/)

---

## Features

- **Unity URP Master Stack (Lit & Unlit)**
  - Targets Unity 2022 LTS / Unity 6 Universal Render Pipeline (`Lit` and `Unlit` sub-targets).
  - Supports Opaque & Transparent surfaces, Blend Modes (Alpha, Premultiply, Additive, Multiply), Render Face (Front/Back/Both), Alpha Clipping, and Cast Shadows.
- **48 Core Shader Nodes & Dynamic Vector Polymorphism**
  - Categories: **Input**, **Math**, **Procedural**, **UV**, **Channel**, **Artistic**, and **Utility**.
  - Dynamic vector ports automatically adapt dimensions (`1`, `2`, `3`, `4`, `Color`, `Texture2D`, `Boolean`) with Unity-style color-coded wires.
- **Dual Real-Time WebGL Previews**
  - **3D Main Preview (Three.js):** Switch between Sphere, Cube, Quad, Torus, Cylinder, and Knot meshes; adjust directional light angle, lighting environment presets (Studio, Cyber Lab, Sunset, Neutral), wireframe mode, time playback, and auto-rotation.
  - **Inline 2D Node Previews:** Collapsible per-node 2D shader previews rendered via a shared offscreen WebGL context.
- **Blackboard & Graph Inspector**
  - Create and expose `Float` / `Slider`, `Vector2`, `Vector3`, `Vector4`, `Color` (with HDR mode), `Texture2D`, and `Boolean` properties.
  - Built-in procedural textures (`uvgrid`, `clouds`, `hex`, `stone`, `radial`, `normal`) plus custom image upload.
- **Groups & Sticky Notes**
  - Drag group headers to move all enclosed nodes and sticky notes together.
  - Resize any group edge or corner (automatically clamped so child nodes remain inside).
  - Group bounds automatically expand/shift when moving a child node past an edge.
- **Unity Import & Export**
  - **Export `.shadergraph`:** Native Unity Shader Graph (SGVersion 3 multi-JSON) asset.
  - **Export `.shader`:** Standalone Unity URP ShaderLab + HLSL file ready to drop into a Unity project.
  - **Import `.shadergraph`:** Parses Unity `.shadergraph` files and preserves unrecognized Unity nodes as passthrough placeholders.
  - **Inspect GLSL:** View the compiled WebGL vertex and fragment shaders in real time.
- **Starter Templates**
  - *Cyber Hologram Scanlines*
  - *Magma Dissolve Cutout*
  - *Voronoi Water Caustics*
  - *Gold-Veined Marble PBR*
- **Desktop & Mobile Touch UX**
  - Pinch-to-zoom, pan, drag-to-connect or tap-to-connect wiring, floating Picture-in-Picture 3D preview on mobile, and bottom-sheet panels.
- **WebGL & Shader Diagnostics**
  - Built-in Diagnostics modal captures WebGL shader compile/link errors, GPU capabilities, and runtime exceptions with one-click JSON report copying and cache reset.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8
- **3D & Shaders:** Three.js (`THREE.ShaderMaterial` / WebGL)
- **Icons:** Lucide React

---

## Project Structure

```text
shadergraph-web/
├── src/
│   ├── compiler/
│   │   ├── shaderCompiler.ts       # Topological sort, dynamic port resolution, GLSL & HLSL/ShaderLab compilers
│   │   └── unityShaderGraphIO.ts   # Native Unity .shadergraph (SGVersion 3) serializer & parser
│   ├── components/
│   │   ├── AddNodeModal.tsx        # Searchable node creation menu & wire-drop menu
│   │   ├── DiagnosticsModal.tsx    # WebGL shader compiler error & GPU diagnostics viewer
│   │   ├── ExportModal.tsx         # .shadergraph, .shader, GLSL viewer & file importer
│   │   ├── GraphCanvas.tsx         # Interactive pan/zoom node canvas, wires, groups & sticky notes
│   │   ├── MainPreview3D.tsx       # Three.js 3D preview viewport
│   │   ├── NodeInlinePreview.tsx   # Shared-context 2D per-node shader preview
│   │   └── SidePanels.tsx          # Blackboard properties & Graph/Node Inspector
│   ├── nodes/
│   │   └── nodeRegistry.ts         # 48 Unity Shader Graph node definitions
│   ├── templates/
│   │   └── starterTemplates.ts     # 4 built-in starter shader templates
│   ├── types/
│   │   └── shadergraph.ts          # Core graph, node, port, property & settings types
│   ├── utils/
│   │   ├── diagnosticsStore.ts     # WebGL shader validator & global error collector
│   │   └── textureManager.ts       # Procedural canvas textures & custom image upload
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

---

## Local Development

```bash
cd shadergraph-web
npm install
npm run dev
```

### Other Scripts

- `npm run build` — Type-check (`tsc -b`) and build production bundle to `shadergraph-web/dist/`
- `npm run lint` — Run `oxlint`
- `npm run preview` — Preview the production build locally