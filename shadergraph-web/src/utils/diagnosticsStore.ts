export interface DiagnosticEntry {
  id: string;
  timestamp: number;
  level: 'error' | 'warn' | 'info';
  source: string;
  message: string;
  details?: string;
  vertexShader?: string;
  fragmentShader?: string;
}

export interface WebGLDeviceInfo {
  webglVersion: string;
  glslVersion: string;
  vendor: string;
  renderer: string;
  unmaskedRenderer: string;
  maxVaryingVectors: number;
  maxTextureUnits: number;
  maxFragmentUniformVectors: number;
  userAgent: string;
}

const entries: DiagnosticEntry[] = [];
const listeners = new Set<() => void>();
let autoOpenListeners = new Set<() => void>();
let cachedDeviceInfo: WebGLDeviceInfo | null = null;
let globalHooksInstalled = false;

function notify() {
  for (const l of listeners) {
    l();
  }
}

export function subscribeDiagnostics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onDiagnosticErrorAutoOpen(listener: () => void): () => void {
  autoOpenListeners.add(listener);
  return () => autoOpenListeners.delete(listener);
}

export function getDiagnostics(): DiagnosticEntry[] {
  return [...entries];
}

export function clearDiagnostics() {
  entries.length = 0;
  notify();
}

export function clearDiagnosticsBySourcePrefix(prefix: string) {
  let changed = false;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].source.startsWith(prefix)) {
      entries.splice(i, 1);
      changed = true;
    }
  }
  if (changed) notify();
}

export function logDiagnostic(entry: Omit<DiagnosticEntry, 'id' | 'timestamp'>) {
  // Deduplicate identical consecutive source+message
  const existingIdx = entries.findIndex(
    (e) => e.source === entry.source && e.message === entry.message
  );
  const full: DiagnosticEntry = {
    ...entry,
    id: `diag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };

  if (existingIdx !== -1) {
    entries[existingIdx] = full;
  } else {
    entries.unshift(full);
    if (entries.length > 60) entries.pop();
  }

  notify();

  if (entry.level === 'error') {
    for (const l of autoOpenListeners) {
      l();
    }
  }
}

export function getWebGLDeviceInfo(): WebGLDeviceInfo {
  if (cachedDeviceInfo) return cachedDeviceInfo;
  try {
    const cvs = document.createElement('canvas');
    const gl =
      (cvs.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (cvs.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) {
      cachedDeviceInfo = {
        webglVersion: 'Unavailable',
        glslVersion: 'Unavailable',
        vendor: 'Unknown',
        renderer: 'Unknown',
        unmaskedRenderer: 'No WebGL Context',
        maxVaryingVectors: 0,
        maxTextureUnits: 0,
        maxFragmentUniformVectors: 0,
        userAgent: navigator.userAgent,
      };
      return cachedDeviceInfo;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    cachedDeviceInfo = {
      webglVersion: String(gl.getParameter(gl.VERSION) || ''),
      glslVersion: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || ''),
      vendor: String(gl.getParameter(gl.VENDOR) || ''),
      renderer: String(gl.getParameter(gl.RENDERER) || ''),
      unmaskedRenderer: dbg
        ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
        : 'Masked by browser',
      maxVaryingVectors: Number(gl.getParameter(gl.MAX_VARYING_VECTORS) || 0),
      maxTextureUnits: Number(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 0),
      maxFragmentUniformVectors: Number(
        gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 0
      ),
      userAgent: navigator.userAgent,
    };
    return cachedDeviceInfo;
  } catch (err: any) {
    return {
      webglVersion: 'Error querying WebGL',
      glslVersion: '',
      vendor: '',
      renderer: String(err?.message || err),
      unmaskedRenderer: '',
      maxVaryingVectors: 0,
      maxTextureUnits: 0,
      maxFragmentUniformVectors: 0,
      userAgent: navigator.userAgent,
    };
  }
}

function addLineNumbers(src: string): string {
  return src
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(3, ' ')}: ${line}`)
    .join('\n');
}

/**
 * Attaches a Three.js `renderer.debug.onShaderError` hook to capture any WebGL shader compile/link failure.
 */
export function attachThreeRendererDiagnostics(
  renderer: any,
  rendererLabel: string
) {
  if (!renderer || !renderer.debug) return;
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    glVertexShader: WebGLShader,
    glFragmentShader: WebGLShader
  ) => {
    const vertLog = gl.getShaderInfoLog(glVertexShader) || '';
    const fragLog = gl.getShaderInfoLog(glFragmentShader) || '';
    const progLog = gl.getProgramInfoLog(program) || '';
    const vertSrc = gl.getShaderSource(glVertexShader) || '';
    const fragSrc = gl.getShaderSource(glFragmentShader) || '';

    const combinedLog = [
      vertLog ? `[Vertex Shader Log]\n${vertLog.trim()}` : '',
      fragLog ? `[Fragment Shader Log]\n${fragLog.trim()}` : '',
      progLog ? `[Program Link Log]\n${progLog.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    logDiagnostic({
      level: 'error',
      source: rendererLabel,
      message: `WebGL Shader Compile/Link Error in ${rendererLabel}`,
      details: combinedLog || 'Unknown WebGL shader compilation failure',
      vertexShader: addLineNumbers(vertSrc),
      fragmentShader: addLineNumbers(fragSrc),
    });
  };
}

let validatorGl: WebGLRenderingContext | null = null;

export function registerDiagnosticWebGLContext(gl: WebGLRenderingContext | null) {
  if (gl && !gl.isContextLost()) {
    validatorGl = gl;
  }
}

/**
 * Proactively validates a Three.js ShaderMaterial vertex/fragment shader pair against the browser's WebGL compiler.
 * Returns true if compilation & linking succeeded, or false if an error was logged.
 */
export function validateShaderProgram(
  sourceLabel: string,
  vertexShaderBody: string,
  fragmentShaderBody: string
): boolean {
  try {
    if (!validatorGl || validatorGl.isContextLost()) {
      const cvs = document.createElement('canvas');
      validatorGl =
        (cvs.getContext('webgl2') as WebGLRenderingContext | null) ||
        (cvs.getContext('webgl') as WebGLRenderingContext | null);
    }
    const gl = validatorGl;
    if (!gl) {
      logDiagnostic({
        level: 'error',
        source: sourceLabel,
        message: 'Could not acquire WebGL context for shader validation.',
      });
      return false;
    }

    const vertFull = `precision highp float;
precision highp int;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
${vertexShaderBody}`;

    const fragFull = `precision highp float;
precision highp int;
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
${fragmentShaderBody}`;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) return true;

    gl.shaderSource(vs, vertFull);
    gl.compileShader(vs);
    const vsOk = gl.getShaderParameter(vs, gl.COMPILE_STATUS);
    const vsLog = gl.getShaderInfoLog(vs) || '';

    gl.shaderSource(fs, fragFull);
    gl.compileShader(fs);
    const fsOk = gl.getShaderParameter(fs, gl.COMPILE_STATUS);
    const fsLog = gl.getShaderInfoLog(fs) || '';

    if (!vsOk || !fsOk) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      logDiagnostic({
        level: 'error',
        source: sourceLabel,
        message: !vsOk
          ? `Vertex Shader Error (${sourceLabel}): ${vsLog.split('\n')[0]}`
          : `Fragment Shader Error (${sourceLabel}): ${fsLog.split('\n')[0]}`,
        details: [
          !vsOk ? `[Vertex Shader InfoLog]\n${vsLog}` : '',
          !fsOk ? `[Fragment Shader InfoLog]\n${fsLog}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        vertexShader: addLineNumbers(vertFull),
        fragmentShader: addLineNumbers(fragFull),
      });
      return false;
    }

    const prog = gl.createProgram();
    if (prog) {
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      const linkOk = gl.getProgramParameter(prog, gl.LINK_STATUS);
      const linkLog = gl.getProgramInfoLog(prog) || '';
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!linkOk) {
        logDiagnostic({
          level: 'error',
          source: sourceLabel,
          message: `Shader Program Link Error (${sourceLabel}): ${linkLog.split('\n')[0]}`,
          details: linkLog,
          vertexShader: addLineNumbers(vertFull),
          fragmentShader: addLineNumbers(fragFull),
        });
        return false;
      }
    } else {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    }

    // Clear any previous error for this sourceLabel once it compiles cleanly
    clearDiagnosticsBySourcePrefix(sourceLabel);
    return true;
  } catch (err: any) {
    logDiagnostic({
      level: 'error',
      source: sourceLabel,
      message: `Exception during shader validation: ${err?.message || String(err)}`,
    });
    return false;
  }
}

export function installGlobalDiagnosticListeners() {
  if (globalHooksInstalled || typeof window === 'undefined') return;
  globalHooksInstalled = true;

  window.addEventListener('error', (event) => {
    logDiagnostic({
      level: 'error',
      source: 'Window Runtime Error',
      message: event.message || 'Uncaught Runtime Error',
      details: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logDiagnostic({
      level: 'error',
      source: 'Unhandled Promise Rejection',
      message: reason?.message || String(reason || 'Promise rejected'),
      details: reason?.stack || undefined,
    });
  });
}
