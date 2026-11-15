import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ShaderGraphProject } from '../types/shadergraph';
import { compileToWebGL, hexToRgbNormalized } from '../compiler/shaderCompiler';
import { getTextureEntry, subscribeTextures } from '../utils/textureManager';

interface NodeInlinePreviewProps {
  nodeId: string;
  project: ShaderGraphProject;
}

// Shared singleton offscreen WebGL renderer so 50+ inline node previews use only 1 WebGL context
let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedScene: THREE.Scene | null = null;
let sharedCamera: THREE.OrthographicCamera | null = null;
let sharedMesh: THREE.Mesh | null = null;

function getSharedPreviewEngine() {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: true,
    });
    sharedRenderer.setSize(136, 136, false);
    sharedScene = new THREE.Scene();
    sharedCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    sharedCamera.position.z = 1;
    const geom = new THREE.PlaneGeometry(1, 1);
    sharedMesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: 0x222222 }));
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

  useEffect(() => {
    const compiled = compileToWebGL(project, nodeId);
    const uniforms: Record<string, { value: any }> = {
      uTime: { value: 1.5 },
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.6).normalize() },
      uLightColor: { value: new THREE.Vector3(1.0, 0.98, 0.95) },
      uAmbientIntensity: { value: 0.6 },
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
        uniforms[uName] = { value: new THREE.Vector4(r, g, b, a) };
      }
    }

    for (const texKey of compiled.referencedTextures) {
      const safeTex = texKey.replace(/[^a-zA-Z0-9_]/g, '_');
      uniforms[`uTex_${safeTex}`] = { value: getTextureEntry(texKey).texture };
    }

    if (materialRef.current) {
      materialRef.current.dispose();
    }

    const mat = new THREE.ShaderMaterial({
      vertexShader: compiled.vertexShader,
      fragmentShader: compiled.fragmentShader,
      uniforms,
    });
    materialRef.current = mat;

    const renderFrame = (timeSec: number) => {
      const cvs = canvasRef.current;
      if (!cvs || !materialRef.current) return;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      const { renderer, scene, camera, mesh } = getSharedPreviewEngine();
      materialRef.current.uniforms.uTime.value = timeSec;
      mesh.material = materialRef.current;
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, 0, 0, cvs.width, cvs.height);
    };

    renderFrame(performance.now() * 0.001);

    const interval = window.setInterval(() => {
      renderFrame(performance.now() * 0.001);
    }, 120);

    const unsub = subscribeTextures(() => {
      for (const texKey of compiled.referencedTextures) {
        const safeTex = texKey.replace(/[^a-zA-Z0-9_]/g, '_');
        if (materialRef.current?.uniforms[`uTex_${safeTex}`]) {
          materialRef.current.uniforms[`uTex_${safeTex}`].value =
            getTextureEntry(texKey).texture;
        }
      }
      renderFrame(performance.now() * 0.001);
    });

    return () => {
      window.clearInterval(interval);
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
