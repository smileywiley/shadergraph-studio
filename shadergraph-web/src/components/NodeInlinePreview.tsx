import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ShaderGraphProject } from '../types/shadergraph';
import {
  compileToWebGL,
  getPropertyUniformName,
  hexToRgbNormalized,
  sanitizeIdentifier,
} from '../compiler/shaderCompiler';
import { getTextureEntry, subscribeTextures } from '../utils/textureManager';
import {
  attachThreeRendererDiagnostics,
  logDiagnostic,
  registerDiagnosticWebGLContext,
  validateShaderProgram,
} from '../utils/diagnosticsStore';

interface NodeInlinePreviewProps {
  nodeId: string;
  project: ShaderGraphProject;
}

// Shared singleton offscreen WebGL renderer so all inline node previews share 1 WebGL context
let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedScene: THREE.Scene | null = null;
let sharedCamera: THREE.OrthographicCamera | null = null;
let sharedMesh: THREE.Mesh | null = null;

// Centralized ticker so all active node previews render sequentially in a single loop
const activePreviewRenderers = new Map<string, (timeSec: number) => void>();
let globalTickerId: number | null = null;

function ensureGlobalPreviewTicker() {
  if (globalTickerId !== null) return;
  globalTickerId = window.setInterval(() => {
    if (activePreviewRenderers.size === 0) return;
    const nowSec = performance.now() * 0.001;
    for (const fn of activePreviewRenderers.values()) {
      fn(nowSec);
    }
  }, 140);
}

function getSharedPreviewEngine() {
  if (sharedRenderer) {
    const gl = sharedRenderer.getContext();
    if (gl && gl.isContextLost()) {
      logDiagnostic({
        level: 'warn',
        source: 'NodeInlinePreview',
        message: 'Offscreen 2D node preview WebGL context was lost; recreating.',
      });
      sharedRenderer.dispose();
      sharedRenderer = null;
    }
  }

  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'default',
      preserveDrawingBuffer: true,
    });
    sharedRenderer.setPixelRatio(1);
    sharedRenderer.setSize(136, 136, false);
    attachThreeRendererDiagnostics(sharedRenderer, 'NodeInlinePreview');
    registerDiagnosticWebGLContext(sharedRenderer.getContext());

    sharedScene = new THREE.Scene();
    sharedCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    sharedCamera.position.set(0, 0, 1);
    sharedCamera.lookAt(0, 0, 0);

    const geom = new THREE.PlaneGeometry(1, 1);
    sharedMesh = new THREE.Mesh(
      geom,
      new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide })
    );
    sharedScene.add(sharedMesh);
  }
  return {
    renderer: sharedRenderer!,
    scene: sharedScene!,
    camera: sharedCamera!,
    mesh: sharedMesh!,
  };
}

export const NodeInlinePreview: React.FC<NodeInlinePreviewProps> = ({ nodeId, project }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const validRef = useRef<boolean>(true);

  useEffect(() => {
    ensureGlobalPreviewTicker();
    const compiled = compileToWebGL(project, nodeId);

    const engine = getSharedPreviewEngine();
    registerDiagnosticWebGLContext(engine.renderer.getContext());

    const isShaderValid = validateShaderProgram(
      `NodePreview:${nodeId}`,
      compiled.vertexShader,
      compiled.fragmentShader
    );
    validRef.current = isShaderValid;

    const uniforms: Record<string, { value: any }> = {
      uTime: { value: 1.5 },
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.6).normalize() },
      uLightColor: { value: new THREE.Vector3(1.0, 0.98, 0.95) },
      uAmbientIntensity: { value: 0.65 },
    };

    for (const prop of project.properties) {
      const uName = getPropertyUniformName(prop);
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
      const safeTex = sanitizeIdentifier(texKey);
      uniforms[`uTex_${safeTex}`] = { value: getTextureEntry(texKey).texture };
    }

    if (materialRef.current) {
      materialRef.current.dispose();
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: compiled.vertexShader,
      fragmentShader: compiled.fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materialRef.current = mat;

    const renderFrame = (timeSec: number) => {
      const cvs = canvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      if (!validRef.current || !materialRef.current) {
        ctx.fillStyle = '#2a1215';
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('GLSL ERROR', 28, 66);
        return;
      }

      try {
        const { renderer, scene, camera, mesh } = getSharedPreviewEngine();
        materialRef.current.uniforms.uTime.value = timeSec;
        mesh.material = materialRef.current;
        renderer.render(scene, camera);
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(renderer.domElement, 0, 0, cvs.width, cvs.height);
      } catch (err: any) {
        logDiagnostic({
          level: 'error',
          source: `NodePreview:${nodeId}`,
          message: `2D preview draw failed: ${err?.message || String(err)}`,
        });
      }
    };

    renderFrame(performance.now() * 0.001);
    activePreviewRenderers.set(nodeId, renderFrame);

    const unsub = subscribeTextures(() => {
      for (const texKey of compiled.referencedTextures) {
        const safeTex = sanitizeIdentifier(texKey);
        if (materialRef.current?.uniforms[`uTex_${safeTex}`]) {
          materialRef.current.uniforms[`uTex_${safeTex}`].value =
            getTextureEntry(texKey).texture;
        }
      }
      renderFrame(performance.now() * 0.001);
    });

    return () => {
      activePreviewRenderers.delete(nodeId);
      unsub();
      if (materialRef.current) {
        materialRef.current.dispose();
        materialRef.current = null;
      }
    };
  }, [nodeId, project]);

  return (
    <div className="sg-node-preview-box">
      <canvas
        ref={canvasRef}
        width={136}
        height={136}
        className="sg-node-preview-canvas"
      />
    </div>
  );
};
