import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ShaderGraphProject,
  PreviewMeshType,
  EnvironmentPreset,
} from '../types/shadergraph';
import { compileToWebGL, hexToRgbNormalized } from '../compiler/shaderCompiler';
import { getTextureEntry, subscribeTextures } from '../utils/textureManager';
import {
  Play,
  Pause,
  RotateCw,
  Grid,
  Maximize2,
  Minimize2,
  Sun,
  Box,
} from 'lucide-react';

interface MainPreview3DProps {
  project: ShaderGraphProject;
  isMobile: boolean;
  pipMinimized: boolean;
  onTogglePipMinimize: () => void;
}

const ENV_PRESETS: Record<
  EnvironmentPreset,
  { bgTop: string; bgBottom: string; lightColor: [number, number, number]; ambient: number }
> = {
  studio: {
    bgTop: '#161b26',
    bgBottom: '#0b0e14',
    lightColor: [1.0, 0.98, 0.95],
    ambient: 0.65,
  },
  sunset: {
    bgTop: '#2b192e',
    bgBottom: '#110b18',
    lightColor: [1.0, 0.72, 0.52],
    ambient: 0.55,
  },
  cyber: {
    bgTop: '#071c29',
    bgBottom: '#040a10',
    lightColor: [0.65, 0.95, 1.0],
    ambient: 0.75,
  },
  neutral: {
    bgTop: '#1e2024',
    bgBottom: '#121316',
    lightColor: [1.0, 1.0, 1.0],
    ambient: 0.6,
  },
};

export const MainPreview3D: React.FC<MainPreview3DProps> = ({
  project,
  isMobile,
  pipMinimized,
  onTogglePipMinimize,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [meshType, setMeshType] = useState<PreviewMeshType>('sphere');
  const [envPreset, setEnvPreset] = useState<EnvironmentPreset>('studio');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [lightAngle, setLightAngle] = useState<number>(45);
  const [expandedFullscreen, setExpandedFullscreen] = useState<boolean>(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const orbitRef = useRef({
    theta: 0.5,
    phi: 1.2,
    radius: 2.65,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    pinchDist: 0,
  });

  const stateRef = useRef({
    autoRotate,
    isPlaying,
    lightAngle,
    envPreset,
    wireframe,
  });
  stateRef.current = { autoRotate, isPlaying, lightAngle, envPreset, wireframe };

  // Initialize Three.js Scene & Renderer once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      100
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 280, container.clientHeight || 240);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Subtle reference floor grid
    const grid = new THREE.GridHelper(4, 12, 0x2a3444, 0x1a202c);
    grid.position.y = -1.15;
    scene.add(grid);

    const geom = new THREE.SphereGeometry(0.95, 64, 64);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLightDir: { value: new THREE.Vector3(0.6, 0.8, 0.5).normalize() },
        uLightColor: { value: new THREE.Vector3(1, 0.98, 0.95) },
        uAmbientIntensity: { value: 0.65 },
      },
    });
    materialRef.current = mat;

    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);
    meshRef.current = mesh;

    let animId = 0;
    let accumTime = 0;
    let lastTick = performance.now();

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(0.1, (now - lastTick) * 0.001);
      lastTick = now;

      if (stateRef.current.isPlaying) {
        accumTime += dt;
      }

      if (stateRef.current.autoRotate && !orbitRef.current.isDragging && meshRef.current) {
        meshRef.current.rotation.y += dt * 0.42;
      }

      const { theta, phi, radius } = orbitRef.current;
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0, 0);

      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = accumTime;
        const rad = (stateRef.current.lightAngle * Math.PI) / 180;
        materialRef.current.uniforms.uLightDir.value
          .set(Math.cos(rad), 0.75, Math.sin(rad))
          .normalize();
        const preset = ENV_PRESETS[stateRef.current.envPreset];
        materialRef.current.uniforms.uLightColor.value.set(...preset.lightColor);
        materialRef.current.uniforms.uAmbientIntensity.value = preset.ambient;
        materialRef.current.wireframe = stateRef.current.wireframe;
      }

      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(animate);

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = Math.max(60, container.clientWidth);
      const h = Math.max(60, container.clientHeight);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Update geometry when meshType changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.geometry.dispose();
    switch (meshType) {
      case 'cube':
        mesh.geometry = new THREE.BoxGeometry(1.35, 1.35, 1.35, 32, 32, 32);
        break;
      case 'quad':
        mesh.geometry = new THREE.PlaneGeometry(1.65, 1.65, 64, 64);
        break;
      case 'torus':
        mesh.geometry = new THREE.TorusGeometry(0.72, 0.28, 48, 96);
        break;
      case 'cylinder':
        mesh.geometry = new THREE.CylinderGeometry(0.68, 0.68, 1.45, 64, 32);
        break;
      case 'knot':
        mesh.geometry = new THREE.TorusKnotGeometry(0.6, 0.2, 128, 32);
        break;
      case 'sphere':
      default:
        mesh.geometry = new THREE.SphereGeometry(0.95, 64, 64);
        break;
    }
  }, [meshType]);

  // Compile and hot-swap shader material whenever project changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const compiled = compileToWebGL(project);
    const prevTime = materialRef.current?.uniforms?.uTime?.value ?? 0;

    const uniforms: Record<string, { value: any }> = {
      uTime: { value: prevTime },
      uLightDir: { value: new THREE.Vector3(0.6, 0.8, 0.5).normalize() },
      uLightColor: { value: new THREE.Vector3(1.0, 0.98, 0.95) },
      uAmbientIntensity: { value: 0.65 },
    };

    for (const prop of project.properties) {
      const clean = prop.referenceName.replace(/[^a-zA-Z0-9_]/g, '_');
      const uName = clean.startsWith('_') ? clean : `_${clean}`;
      if (prop.type === 'float') {
        uniforms[uName] = { value: Number(prop.value) || 0 };
      } else if (prop.type === 'boolean') {
        uniforms[uName] = { value: prop.value ? 1.0 : 0.0 };
      } else if (prop.type === 'vector2') {
        const v = Array.isArray(prop.value) ? prop.value : [0, 0];
        uniforms[uName] = { value: new THREE.Vector2(v[0] || 0, v[1] || 0) };
      } else if (prop.type === 'vector3') {
        const v = Array.isArray(prop.value) ? prop.value : [0, 0, 0];
        uniforms[uName] = { value: new THREE.Vector3(v[0] || 0, v[1] || 0, v[2] || 0) };
      } else if (prop.type === 'vector4') {
        const v = Array.isArray(prop.value) ? prop.value : [0, 0, 0, 1];
        uniforms[uName] = {
          value: new THREE.Vector4(v[0] || 0, v[1] || 0, v[2] || 0, v[3] ?? 1),
        };
      } else if (prop.type === 'color') {
        const [r, g, b, a] = hexToRgbNormalized(prop.value || '#ffffff');
        const mult = prop.mode === 'HDR' ? 1.35 : 1.0;
        uniforms[uName] = { value: new THREE.Vector4(r * mult, g * mult, b * mult, a) };
      }
    }

    for (const texKey of compiled.referencedTextures) {
      const safeTex = texKey.replace(/[^a-zA-Z0-9_]/g, '_');
      uniforms[`uTex_${safeTex}`] = { value: getTextureEntry(texKey).texture };
    }

    const isTransparent = project.settings.surfaceType === 'Transparent';
    const side =
      project.settings.renderFace === 'Both'
        ? THREE.DoubleSide
        : project.settings.renderFace === 'Back'
        ? THREE.BackSide
        : THREE.FrontSide;

    let blending: THREE.Blending = THREE.NormalBlending;
    if (isTransparent) {
      if (project.settings.blendMode === 'Additive') blending = THREE.AdditiveBlending;
      else if (project.settings.blendMode === 'Multiply') blending = THREE.MultiplyBlending;
    }

    const newMat = new THREE.ShaderMaterial({
      vertexShader: compiled.vertexShader,
      fragmentShader: compiled.fragmentShader,
      uniforms,
      transparent: isTransparent,
      depthWrite: !isTransparent,
      side,
      blending,
      wireframe: stateRef.current.wireframe,
    });

    if (materialRef.current) {
      materialRef.current.dispose();
    }
    materialRef.current = newMat;
    mesh.material = newMat;

    const unsub = subscribeTextures(() => {
      for (const texKey of compiled.referencedTextures) {
        const safeTex = texKey.replace(/[^a-zA-Z0-9_]/g, '_');
        if (materialRef.current?.uniforms[`uTex_${safeTex}`]) {
          materialRef.current.uniforms[`uTex_${safeTex}`].value =
            getTextureEntry(texKey).texture;
        }
      }
    });

    return () => {
      unsub();
    };
  }, [project]);

  // Pointer / Touch Orbit handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    orbitRef.current.isDragging = true;
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!orbitRef.current.isDragging) return;
    e.stopPropagation();
    const dx = e.clientX - orbitRef.current.lastX;
    const dy = e.clientY - orbitRef.current.lastY;
    orbitRef.current.lastX = e.clientX;
    orbitRef.current.lastY = e.clientY;
    orbitRef.current.theta -= dx * 0.01;
    orbitRef.current.phi = Math.max(0.2, Math.min(Math.PI - 0.2, orbitRef.current.phi - dy * 0.01));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    orbitRef.current.isDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    orbitRef.current.radius = Math.max(
      1.3,
      Math.min(6.0, orbitRef.current.radius + e.deltaY * 0.002)
    );
  };

  const presetStyle = ENV_PRESETS[envPreset];

  return (
    <div
      id="main-preview-panel"
      className={`sg-preview-panel ${isMobile ? 'sg-preview-mobile-pip' : ''} ${
        pipMinimized ? 'sg-preview-minimized' : ''
      } ${expandedFullscreen ? 'sg-preview-expanded' : ''}`}
    >
      {/* Header Bar */}
      <div className="sg-preview-header">
        <div className="sg-preview-title">
          <Box size={14} />
          <span>Main Preview</span>
          <span className="sg-preview-badge">{project.settings.subTarget}</span>
        </div>

        <div className="sg-preview-actions">
          <button
            type="button"
            className={`sg-icon-btn ${isPlaying ? 'active' : ''}`}
            onClick={() => setIsPlaying((p) => !p)}
            title={isPlaying ? 'Pause Time' : 'Play Time'}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            type="button"
            className={`sg-icon-btn ${autoRotate ? 'active' : ''}`}
            onClick={() => setAutoRotate((r) => !r)}
            title="Toggle Auto-Rotate Mesh"
          >
            <RotateCw size={13} />
          </button>
          <button
            type="button"
            className={`sg-icon-btn ${wireframe ? 'active' : ''}`}
            onClick={() => setWireframe((w) => !w)}
            title="Toggle Wireframe"
          >
            <Grid size={13} />
          </button>
          {isMobile ? (
            <button
              type="button"
              className="sg-icon-btn"
              onClick={onTogglePipMinimize}
              title={pipMinimized ? 'Expand Preview' : 'Minimize Preview'}
            >
              {pipMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            </button>
          ) : (
            <button
              type="button"
              className="sg-icon-btn"
              onClick={() => setExpandedFullscreen((f) => !f)}
              title={expandedFullscreen ? 'Restore Size' : 'Enlarge Preview'}
            >
              {expandedFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* 3D WebGL Viewport */}
      <div
        ref={mountRef}
        className="sg-preview-viewport"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${presetStyle.bgTop}, ${presetStyle.bgBottom})`,
          display: pipMinimized ? 'none' : 'block',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Footer Controls (Mesh selector + Light angle + Environment) */}
      {!pipMinimized && (
        <div className="sg-preview-footer">
          <div className="sg-mesh-pills">
            {(['sphere', 'cube', 'quad', 'torus', 'cylinder', 'knot'] as PreviewMeshType[]).map(
              (m) => (
                <button
                  key={m}
                  type="button"
                  className={`sg-mesh-pill ${meshType === m ? 'active' : ''}`}
                  onClick={() => setMeshType(m)}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              )
            )}
          </div>

          <div className="sg-preview-subbar">
            <label className="sg-light-slider" title="Directional Light Angle">
              <Sun size={12} />
              <input
                type="range"
                min={0}
                max={360}
                value={lightAngle}
                onChange={(e) => setLightAngle(Number(e.target.value))}
              />
            </label>

            <select
              className="sg-env-select"
              value={envPreset}
              onChange={(e) => setEnvPreset(e.target.value as EnvironmentPreset)}
              title="Lighting Environment"
            >
              <option value="studio">Studio</option>
              <option value="cyber">Cyber Lab</option>
              <option value="sunset">Sunset</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
