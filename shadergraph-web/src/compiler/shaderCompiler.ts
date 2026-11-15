import {
  ShaderGraphProject,
  GraphNode,
  ResolvedPortType,
  PortDefinition,
  BlackboardProperty,
} from '../types/shadergraph';
import { getNodeDefinition } from '../nodes/nodeRegistry';

export interface PortResolutionMap {
  [nodeId: string]: {
    inputs: Record<string, ResolvedPortType>;
    outputs: Record<string, ResolvedPortType>;
  };
}

export interface CompiledWebGLShader {
  vertexShader: string;
  fragmentShader: string;
  portResolutions: PortResolutionMap;
  referencedTextures: string[];
  errors: string[];
}

export function hexToRgbNormalized(hex: string): [number, number, number, number] {
  const clean = (hex || '#ffffff').replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [r || 0, g || 0, b || 0, 1.0];
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const a = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1.0;
  return [
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
    Number.isFinite(a) ? a : 1,
  ];
}

function dimToNumber(t: ResolvedPortType): number {
  if (t === '1' || t === 'boolean') return 1;
  if (t === '2') return 2;
  if (t === '3') return 3;
  if (t === '4' || t === 'color') return 4;
  return 1;
}

function numberToDim(n: number): ResolvedPortType {
  if (n <= 1) return '1';
  if (n === 2) return '2';
  if (n === 3) return '3';
  return '4';
}

/**
 * Topologically sorts nodes in the graph and resolves Dynamic Vector port dimensions.
 */
export function resolveGraphOrderAndPorts(project: ShaderGraphProject): {
  sortedNodes: GraphNode[];
  portResolutions: PortResolutionMap;
} {
  const nodeMap = new Map<string, GraphNode>(project.nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sortedNodes: GraphNode[] = [];

  function visit(nodeId: string) {
    if (visited.has(nodeId) || visiting.has(nodeId)) return;
    visiting.add(nodeId);
    const incomingEdges = project.edges.filter((e) => e.targetNodeId === nodeId);
    for (const edge of incomingEdges) {
      if (nodeMap.has(edge.sourceNodeId)) {
        visit(edge.sourceNodeId);
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    const n = nodeMap.get(nodeId);
    if (n) sortedNodes.push(n);
  }

  for (const node of project.nodes) {
    visit(node.id);
  }

  const portResolutions: PortResolutionMap = {};

  for (const node of sortedNodes) {
    const def = getNodeDefinition(node, project.properties);
    const inputMap: Record<string, ResolvedPortType> = {};
    const outputMap: Record<string, ResolvedPortType> = {};

    let maxDynamicDim = 1;
    let hasConnectedDynamic = false;

    for (const input of def.inputs) {
      const edge = project.edges.find(
        (e) => e.targetNodeId === node.id && e.targetPortId === input.id
      );
      if (edge) {
        const upstreamRes =
          portResolutions[edge.sourceNodeId]?.outputs[edge.sourcePortId] || '1';
        if (input.type === 'dynamic') {
          const d = dimToNumber(upstreamRes);
          maxDynamicDim = Math.max(maxDynamicDim, d);
          hasConnectedDynamic = true;
          inputMap[input.id] = numberToDim(d);
        } else if (input.type === 'color') {
          inputMap[input.id] = 'color';
        } else {
          inputMap[input.id] = input.type;
        }
      } else {
        if (input.type === 'dynamic') {
          const val = node.inputValues?.[input.id] ?? input.defaultValue;
          if (Array.isArray(val)) {
            const d = Math.min(4, Math.max(1, val.length));
            maxDynamicDim = Math.max(maxDynamicDim, d);
            inputMap[input.id] = numberToDim(d);
          } else {
            inputMap[input.id] = '1';
          }
        } else if (input.type === 'color') {
          inputMap[input.id] = 'color';
        } else {
          inputMap[input.id] = input.type;
        }
      }
    }

    const resolvedDynamic = numberToDim(hasConnectedDynamic ? maxDynamicDim : maxDynamicDim);

    // Unify dynamic inputs to the node's resolved dynamic dimension
    for (const input of def.inputs) {
      if (input.type === 'dynamic') {
        inputMap[input.id] = resolvedDynamic;
      }
    }

    for (const output of def.outputs) {
      if (output.type === 'dynamic') {
        outputMap[output.id] = resolvedDynamic;
      } else if (node.typeId === 'swizzle') {
        const mask = String(node.settings?.mask || 'zyxw')
          .toLowerCase()
          .replace(/[^xyzwrgba]/g, '')
          .slice(0, 4);
        outputMap[output.id] = numberToDim(Math.max(1, mask.length));
      } else if (output.type === 'color') {
        outputMap[output.id] = 'color';
      } else {
        outputMap[output.id] = output.type;
      }
    }

    portResolutions[node.id] = { inputs: inputMap, outputs: outputMap };
  }

  return { sortedNodes, portResolutions };
}

function glslType(dim: ResolvedPortType): string {
  switch (dim) {
    case '1':
    case 'boolean':
      return 'float';
    case '2':
      return 'vec2';
    case '3':
      return 'vec3';
    case '4':
    case 'color':
      return 'vec4';
    default:
      return 'float';
  }
}

function hlslType(dim: ResolvedPortType): string {
  switch (dim) {
    case '1':
    case 'boolean':
      return 'float';
    case '2':
      return 'float2';
    case '3':
      return 'float3';
    case '4':
    case 'color':
      return 'float4';
    default:
      return 'float';
  }
}

function formatFloat(n: any, fallback = 0): string {
  const num = typeof n === 'number' && Number.isFinite(n) ? n : parseFloat(n);
  const v = Number.isFinite(num) ? num : fallback;
  const s = v.toFixed(4).replace(/\.?0+$/, '');
  return s.includes('.') ? s : `${s}.0`;
}

/**
 * Casts an expression from `fromDim` to `toDim` in GLSL or HLSL.
 */
function castExpr(
  expr: string,
  fromDim: ResolvedPortType,
  toDim: ResolvedPortType,
  lang: 'glsl' | 'hlsl'
): string {
  const f = dimToNumber(fromDim);
  const t = dimToNumber(toDim);
  if (f === t) return expr;

  const vec2 = lang === 'glsl' ? 'vec2' : 'float2';
  const vec3 = lang === 'glsl' ? 'vec3' : 'float3';
  const vec4 = lang === 'glsl' ? 'vec4' : 'float4';

  if (f === 1) {
    if (t === 2) return `${vec2}(${expr}, ${expr})`;
    if (t === 3) return `${vec3}(${expr}, ${expr}, ${expr})`;
    if (t === 4) return `${vec4}(${expr}, ${expr}, ${expr}, ${expr})`;
  }
  if (f === 2) {
    if (t === 1) return `(${expr}).x`;
    if (t === 3) return `${vec3}((${expr}).xy, 0.0)`;
    if (t === 4) return `${vec4}((${expr}).xy, 0.0, 1.0)`;
  }
  if (f === 3) {
    if (t === 1) return `(${expr}).x`;
    if (t === 2) return `(${expr}).xy`;
    if (t === 4) return `${vec4}((${expr}).xyz, 1.0)`;
  }
  if (f === 4) {
    if (t === 1) return `(${expr}).x`;
    if (t === 2) return `(${expr}).xy`;
    if (t === 3) return `(${expr}).xyz`;
  }
  return expr;
}

function formatDefaultLiteral(
  port: PortDefinition,
  rawVal: any,
  targetDim: ResolvedPortType,
  lang: 'glsl' | 'hlsl'
): string {
  const val = rawVal !== undefined ? rawVal : port.defaultValue;
  const vec2 = lang === 'glsl' ? 'vec2' : 'float2';
  const vec3 = lang === 'glsl' ? 'vec3' : 'float3';
  const vec4 = lang === 'glsl' ? 'vec4' : 'float4';

  // Implicit bindings when unconnected
  if (port.binding && port.binding !== 'none' && rawVal === undefined) {
    switch (port.binding) {
      case 'uv0':
        return castExpr('vUv', '2', targetDim, lang);
      case 'positionOS':
        return castExpr('vPositionOS', '3', targetDim, lang);
      case 'positionWS':
        return castExpr('vPositionWS', '3', targetDim, lang);
      case 'normalOS':
        return castExpr('normalize(vNormalOS)', '3', targetDim, lang);
      case 'normalWS':
        return castExpr('normalize(vNormalWS)', '3', targetDim, lang);
      case 'tangentWS':
        return castExpr('normalize(vTangentWS)', '3', targetDim, lang);
      case 'viewDirWS':
      case 'viewDirTS':
        return castExpr('normalize(vViewDirWS)', '3', targetDim, lang);
      case 'vertexColor':
        return castExpr('vColor', '4', targetDim, lang);
      case 'time':
        return castExpr('uTime', '1', targetDim, lang);
    }
  }

  if (port.type === 'color' || (typeof val === 'string' && val.startsWith('#'))) {
    const [r, g, b, a] = hexToRgbNormalized(typeof val === 'string' ? val : '#ffffff');
    return castExpr(
      `${vec4}(${formatFloat(r)}, ${formatFloat(g)}, ${formatFloat(b)}, ${formatFloat(a)})`,
      '4',
      targetDim,
      lang
    );
  }

  if (typeof val === 'boolean') {
    return val ? '1.0' : '0.0';
  }

  if (Array.isArray(val)) {
    const x = formatFloat(val[0], 0);
    const y = formatFloat(val[1], 0);
    const z = formatFloat(val[2], 0);
    const w = formatFloat(val[3], 1);
    const srcDim = numberToDim(val.length);
    const base =
      val.length === 2
        ? `${vec2}(${x}, ${y})`
        : val.length === 3
        ? `${vec3}(${x}, ${y}, ${z})`
        : `${vec4}(${x}, ${y}, ${z}, ${w})`;
    return castExpr(base, srcDim, targetDim, lang);
  }

  const scalar = formatFloat(val, 0);
  return castExpr(scalar, '1', targetDim, lang);
}

const GLSL_HELPER_FUNCTIONS = `
// --- Unity ShaderGraph Procedural & Artistic Helpers ---
float sg_hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float sg_valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = sg_hash(i);
  float b = sg_hash(i + vec2(1.0, 0.0));
  float c = sg_hash(i + vec2(0.0, 1.0));
  float d = sg_hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float sg_simpleNoise(vec2 uv, float scale) {
  float t = 0.0;
  float freq = 1.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    t += sg_valueNoise(uv * scale * freq) * amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return t;
}

vec2 sg_gradDir(vec2 p) {
  p = mod(p, 289.0);
  float x = (34.0 * p.x + 1.0) * p.x;
  x = mod(x, 289.0) + p.y;
  x = (34.0 * x + 1.0) * x;
  x = fract(x / 41.0) * 2.0 - 1.0;
  return normalize(vec2(x - floor(x + 0.5), abs(x) - 0.5));
}

float sg_gradientNoise(vec2 uv, float scale) {
  vec2 p = uv * scale;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float d00 = dot(sg_gradDir(ip), fp);
  float d01 = dot(sg_gradDir(ip + vec2(0.0, 1.0)), fp - vec2(0.0, 1.0));
  float d10 = dot(sg_gradDir(ip + vec2(1.0, 0.0)), fp - vec2(1.0, 0.0));
  float d11 = dot(sg_gradDir(ip + vec2(1.0, 1.0)), fp - vec2(1.0, 1.0));
  fp = fp * fp * fp * (fp * (fp * 6.0 - 15.0) + 10.0);
  return mix(mix(d00, d01, fp.y), mix(d10, d11, fp.y), fp.x) + 0.5;
}

vec2 sg_voronoiRandom(vec2 uv, float offset) {
  mat2 m = mat2(15.27, 47.63, 99.41, 89.98);
  uv = fract(sin(uv * m) * 46839.32);
  return vec2(sin(uv.y * offset) * 0.5 + 0.5, cos(uv.x * offset) * 0.5 + 0.5);
}

vec2 sg_voronoi(vec2 uv, float angleOffset, float cellDensity) {
  vec2 g = floor(uv * cellDensity);
  vec2 f = fract(uv * cellDensity);
  float minDist = 8.0;
  float cellVal = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 lattice = vec2(float(x), float(y));
      vec2 offset = sg_voronoiRandom(lattice + g, angleOffset);
      float d = distance(lattice + offset, f);
      if (d < minDist) {
        minDist = d;
        cellVal = offset.x;
      }
    }
  }
  return vec2(minDist, cellVal);
}

vec3 sg_checkerboard(vec2 uv, vec3 colorA, vec3 colorB, vec2 frequency) {
  vec2 c = floor(uv * frequency * 2.0);
  float m = mod(c.x + c.y, 2.0);
  return mix(colorA, colorB, m);
}

float sg_ellipse(vec2 uv, float width, float height) {
  float d = length((uv * 2.0 - 1.0) / max(vec2(width, height), vec2(0.0001)));
  return clamp((1.0 - d) / max(fwidth(d), 0.001), 0.0, 1.0);
}

float sg_roundedRectangle(vec2 uv, float width, float height, float radius) {
  radius = max(min(min(abs(radius * 2.0), abs(width)), abs(height)), 1e-5);
  vec2 q = abs(uv * 2.0 - 1.0) - vec2(width, height) + radius;
  float d = length(max(q, 0.0)) / radius;
  return clamp((1.0 - d) / max(fwidth(d), 0.001), 0.0, 1.0);
}

float sg_polygon(vec2 uv, float sides, float width, float height) {
  vec2 p = (uv * 2.0 - 1.0) / max(vec2(width, height), vec2(0.001));
  float a = atan(p.x, p.y) + 3.14159265;
  float r = 6.2831853 / max(sides, 3.0);
  float d = cos(floor(0.5 + a / r) * r - a) * length(p);
  return clamp((1.0 - d) / max(fwidth(d), 0.001), 0.0, 1.0);
}

vec3 sg_hueNormalized(vec3 col, float offset) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 P = mix(vec4(col.bg, K.wz), vec4(col.gb, K.xy), step(col.b, col.g));
  vec4 Q = mix(vec4(P.xyw, col.r), vec4(col.r, P.yzx), step(P.x, col.r));
  float D = Q.x - min(Q.w, Q.y);
  float E = 1e-10;
  vec3 hsv = vec3(abs(Q.z + (Q.w - Q.y) / (6.0 * D + E)), D / (Q.x + E), Q.x);
  hsv.x = fract(hsv.x + offset);
  vec4 K2 = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 P2 = abs(fract(hsv.xxx + K2.xyz) * 6.0 - K2.www);
  return hsv.z * mix(K2.xxx, clamp(P2 - K2.xxx, 0.0, 1.0), hsv.y);
}
`;

function sanitizeIdentifier(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function getPropertyUniformName(prop: BlackboardProperty): string {
  const clean = prop.referenceName.replace(/[^a-zA-Z0-9_]/g, '_');
  return clean.startsWith('_') ? clean : `_${clean}`;
}

/**
 * Emits the code statement(s) for a single GraphNode in either GLSL or HLSL.
 */
function emitNodeCode(
  node: GraphNode,
  project: ShaderGraphProject,
  portResolutions: PortResolutionMap,
  lang: 'glsl' | 'hlsl',
  referencedTextures: Set<string>
): string {
  const def = getNodeDefinition(node, project.properties);
  if (def.isMaster) return '';

  const nid = sanitizeIdentifier(node.id);
  const res = portResolutions[node.id];
  const vec2 = lang === 'glsl' ? 'vec2' : 'float2';
  const vec3 = lang === 'glsl' ? 'vec3' : 'float3';
  const vec4 = lang === 'glsl' ? 'vec4' : 'float4';
  const mixFn = lang === 'glsl' ? 'mix' : 'lerp';
  const fractFn = lang === 'glsl' ? 'fract' : 'frac';
  const atan2Fn = lang === 'glsl' ? 'atan' : 'atan2';
  const typeFn = lang === 'glsl' ? glslType : hlslType;

  const getInputExpr = (portId: string): string => {
    const port = def.inputs.find((p) => p.id === portId);
    const targetDim = res?.inputs[portId] || port?.type || '1';
    const edge = project.edges.find(
      (e) => e.targetNodeId === node.id && e.targetPortId === portId
    );
    if (edge) {
      const srcNid = sanitizeIdentifier(edge.sourceNodeId);
      const srcVar = `n_${srcNid}_${sanitizeIdentifier(edge.sourcePortId)}`;
      const srcDim =
        portResolutions[edge.sourceNodeId]?.outputs[edge.sourcePortId] || '1';
      if (targetDim === 'texture2d') return srcVar;
      return castExpr(srcVar, srcDim, targetDim as ResolvedPortType, lang);
    }
    if (!port) return '0.0';
    return formatDefaultLiteral(
      port,
      node.inputValues?.[portId],
      targetDim as ResolvedPortType,
      lang
    );
  };

  const outVar = (portId: string) => `n_${nid}_${sanitizeIdentifier(portId)}`;
  const outType = (portId: string) => typeFn(res?.outputs[portId] || '1');

  const lines: string[] = [];

  switch (node.typeId) {
    case 'property': {
      const prop = project.properties.find((p) => p.id === node.propertyId);
      if (!prop) {
        lines.push(`${outType('out')} ${outVar('out')} = 0.0;`);
        break;
      }
      const uName = getPropertyUniformName(prop);
      if (prop.type === 'texture2d') {
        const texKey = String(prop.value || 'uvgrid');
        referencedTextures.add(texKey);
        lines.push(`// Property Texture2D ${uName}`);
      } else {
        lines.push(`${outType('out')} ${outVar('out')} = ${uName};`);
      }
      break;
    }

    case 'time': {
      lines.push(`float ${outVar('time')} = uTime;`);
      lines.push(`float ${outVar('sineTime')} = sin(uTime);`);
      lines.push(`float ${outVar('cosineTime')} = cos(uTime);`);
      lines.push(`float ${outVar('deltaTime')} = 0.01667;`);
      lines.push(`float ${outVar('smoothDelta')} = 0.01667;`);
      break;
    }

    case 'uv': {
      lines.push(`${vec4} ${outVar('out')} = ${vec4}(vUv.x, vUv.y, 0.0, 0.0);`);
      break;
    }

    case 'position': {
      const space = node.settings?.space || 'World';
      const src =
        space === 'Object'
          ? 'vPositionOS'
          : space === 'View'
          ? 'vPositionVS'
          : 'vPositionWS';
      lines.push(`${vec3} ${outVar('out')} = ${src};`);
      break;
    }

    case 'normal-vector': {
      const space = node.settings?.space || 'World';
      const src =
        space === 'Object' ? 'normalize(vNormalOS)' : 'normalize(vNormalWS)';
      lines.push(`${vec3} ${outVar('out')} = ${src};`);
      break;
    }

    case 'view-direction': {
      lines.push(`${vec3} ${outVar('out')} = normalize(vViewDirWS);`);
      break;
    }

    case 'vertex-color': {
      lines.push(`${vec4} ${outVar('out')} = vColor;`);
      break;
    }

    case 'screen-position': {
      const mode = node.settings?.mode || 'Default';
      if (mode === 'Center') {
        lines.push(`${vec4} ${outVar('out')} = ${vec4}(vUv * 2.0 - 1.0, 0.0, 1.0);`);
      } else {
        lines.push(`${vec4} ${outVar('out')} = ${vec4}(vUv, 0.0, 1.0);`);
      }
      break;
    }

    case 'float': {
      lines.push(`float ${outVar('out')} = ${getInputExpr('x')};`);
      break;
    }

    case 'slider': {
      const v = formatFloat(node.settings?.value, 0.5);
      lines.push(`float ${outVar('out')} = ${v};`);
      break;
    }

    case 'vector2': {
      lines.push(`${vec2} ${outVar('out')} = ${vec2}(${getInputExpr('x')}, ${getInputExpr('y')});`);
      break;
    }

    case 'vector3': {
      lines.push(
        `${vec3} ${outVar('out')} = ${vec3}(${getInputExpr('x')}, ${getInputExpr('y')}, ${getInputExpr('z')});`
      );
      break;
    }

    case 'vector4': {
      lines.push(
        `${vec4} ${outVar('out')} = ${vec4}(${getInputExpr('x')}, ${getInputExpr('y')}, ${getInputExpr('z')}, ${getInputExpr('w')});`
      );
      break;
    }

    case 'color': {
      const [r, g, b, a] = hexToRgbNormalized(node.settings?.color || '#00d2ff');
      const intensity = Math.max(0, parseFloat(node.settings?.intensity ?? 1.0) || 1.0);
      lines.push(
        `${vec4} ${outVar('out')} = ${vec4}(${formatFloat(r * intensity)}, ${formatFloat(
          g * intensity
        )}, ${formatFloat(b * intensity)}, ${formatFloat(a)});`
      );
      break;
    }

    case 'constant': {
      const cMap: Record<string, string> = {
        PI: '3.14159265',
        TAU: '6.28318530',
        PHI: '1.61803398',
        E: '2.71828182',
        SQRT2: '1.41421356',
      };
      const val = cMap[node.settings?.constant || 'PI'] || '3.14159265';
      lines.push(`float ${outVar('out')} = ${val};`);
      break;
    }

    case 'boolean': {
      const b = node.settings?.value !== false ? '1.0' : '0.0';
      lines.push(`float ${outVar('out')} = ${b};`);
      break;
    }

    case 'texture2d-asset': {
      const texKey = String(node.settings?.textureKey || 'uvgrid');
      referencedTextures.add(texKey);
      lines.push(`// Texture2D Asset: ${texKey}`);
      break;
    }

    case 'sample-texture2d': {
      // Find connected texture asset or property
      let texKey = String(node.settings?.textureKey || 'uvgrid');
      const texEdge = project.edges.find(
        (e) => e.targetNodeId === node.id && e.targetPortId === 'texture'
      );
      if (texEdge) {
        const srcNode = project.nodes.find((n) => n.id === texEdge.sourceNodeId);
        if (srcNode?.typeId === 'texture2d-asset') {
          texKey = String(srcNode.settings?.textureKey || 'uvgrid');
        } else if (srcNode?.typeId === 'property' && srcNode.propertyId) {
          const prop = project.properties.find((p) => p.id === srcNode.propertyId);
          if (prop) texKey = String(prop.value || 'uvgrid');
        }
      }
      referencedTextures.add(texKey);
      const safeTex = sanitizeIdentifier(texKey);
      const uvExpr = getInputExpr('uv');
      if (lang === 'glsl') {
        lines.push(`${vec4} ${outVar('rgba')} = texture2D(uTex_${safeTex}, ${uvExpr});`);
      } else {
        lines.push(
          `${vec4} ${outVar('rgba')} = SAMPLE_TEXTURE2D(_Tex_${safeTex}, sampler_Tex_${safeTex}, ${uvExpr});`
        );
      }
      lines.push(`float ${outVar('r')} = ${outVar('rgba')}.r;`);
      lines.push(`float ${outVar('g')} = ${outVar('rgba')}.g;`);
      lines.push(`float ${outVar('b')} = ${outVar('rgba')}.b;`);
      lines.push(`float ${outVar('a')} = ${outVar('rgba')}.a;`);
      break;
    }

    // MATH NODES
    case 'add':
      lines.push(`${outType('out')} ${outVar('out')} = (${getInputExpr('a')}) + (${getInputExpr('b')});`);
      break;
    case 'subtract':
      lines.push(`${outType('out')} ${outVar('out')} = (${getInputExpr('a')}) - (${getInputExpr('b')});`);
      break;
    case 'multiply':
      lines.push(`${outType('out')} ${outVar('out')} = (${getInputExpr('a')}) * (${getInputExpr('b')});`);
      break;
    case 'divide':
      lines.push(
        `${outType('out')} ${outVar('out')} = (${getInputExpr('a')}) / max(abs(${getInputExpr('b')}), 0.0001);`
      );
      break;
    case 'power':
      lines.push(
        `${outType('out')} ${outVar('out')} = pow(max(${getInputExpr('a')}, ${castExpr(
          '0.0001',
          '1',
          res?.outputs['out'] || '1',
          lang
        )}), ${getInputExpr('b')});`
      );
      break;
    case 'sqrt':
      lines.push(
        `${outType('out')} ${outVar('out')} = sqrt(max(${getInputExpr('in')}, ${castExpr(
          '0.0',
          '1',
          res?.outputs['out'] || '1',
          lang
        )}));`
      );
      break;
    case 'abs':
      lines.push(`${outType('out')} ${outVar('out')} = abs(${getInputExpr('in')});`);
      break;
    case 'negate':
      lines.push(`${outType('out')} ${outVar('out')} = -(${getInputExpr('in')});`);
      break;
    case 'one-minus': {
      const one = castExpr('1.0', '1', res?.outputs['out'] || '1', lang);
      lines.push(`${outType('out')} ${outVar('out')} = ${one} - (${getInputExpr('in')});`);
      break;
    }
    case 'saturate': {
      const zero = castExpr('0.0', '1', res?.outputs['out'] || '1', lang);
      const one = castExpr('1.0', '1', res?.outputs['out'] || '1', lang);
      lines.push(`${outType('out')} ${outVar('out')} = clamp(${getInputExpr('in')}, ${zero}, ${one});`);
      break;
    }
    case 'clamp':
      lines.push(
        `${outType('out')} ${outVar('out')} = clamp(${getInputExpr('in')}, ${getInputExpr('min')}, ${getInputExpr('max')});`
      );
      break;
    case 'min':
      lines.push(`${outType('out')} ${outVar('out')} = min(${getInputExpr('a')}, ${getInputExpr('b')});`);
      break;
    case 'max':
      lines.push(`${outType('out')} ${outVar('out')} = max(${getInputExpr('a')}, ${getInputExpr('b')});`);
      break;
    case 'lerp':
      lines.push(
        `${outType('out')} ${outVar('out')} = ${mixFn}(${getInputExpr('a')}, ${getInputExpr('b')}, ${getInputExpr('t')});`
      );
      break;
    case 'inverse-lerp':
      lines.push(
        `${outType('out')} ${outVar('out')} = ((${getInputExpr('t')}) - (${getInputExpr('a')})) / max((${getInputExpr('b')}) - (${getInputExpr('a')}), ${castExpr('0.0001', '1', res?.outputs['out'] || '1', lang)});`
      );
      break;
    case 'remap': {
      const inVal = getInputExpr('in');
      const inMM = getInputExpr('inMinMax');
      const outMM = getInputExpr('outMinMax');
      const d = res?.outputs['out'] || '1';
      const inMin = castExpr(`(${inMM}).x`, '1', d, lang);
      const inMax = castExpr(`(${inMM}).y`, '1', d, lang);
      const outMin = castExpr(`(${outMM}).x`, '1', d, lang);
      const outMax = castExpr(`(${outMM}).y`, '1', d, lang);
      lines.push(
        `${outType('out')} ${outVar('out')} = ${outMin} + ((${inVal}) - ${inMin}) * (${outMax} - ${outMin}) / max(${inMax} - ${inMin}, ${castExpr('0.0001', '1', d, lang)});`
      );
      break;
    }
    case 'fraction':
      lines.push(`${outType('out')} ${outVar('out')} = ${fractFn}(${getInputExpr('in')});`);
      break;
    case 'floor':
      lines.push(`${outType('out')} ${outVar('out')} = floor(${getInputExpr('in')});`);
      break;
    case 'ceil':
      lines.push(`${outType('out')} ${outVar('out')} = ceil(${getInputExpr('in')});`);
      break;
    case 'round':
      lines.push(`${outType('out')} ${outVar('out')} = floor((${getInputExpr('in')}) + 0.5);`);
      break;
    case 'posterize':
      lines.push(
        `${outType('out')} ${outVar('out')} = floor((${getInputExpr('in')}) * max(${getInputExpr('steps')}, ${castExpr('1.0', '1', res?.outputs['out'] || '1', lang)})) / max(${getInputExpr('steps')}, ${castExpr('1.0', '1', res?.outputs['out'] || '1', lang)});`
      );
      break;
    case 'step':
      lines.push(`${outType('out')} ${outVar('out')} = step(${getInputExpr('edge')}, ${getInputExpr('in')});`);
      break;
    case 'smoothstep':
      lines.push(
        `${outType('out')} ${outVar('out')} = smoothstep(${getInputExpr('edge1')}, ${getInputExpr('edge2')}, ${getInputExpr('in')});`
      );
      break;
    case 'sine':
      lines.push(`${outType('out')} ${outVar('out')} = sin(${getInputExpr('in')});`);
      break;
    case 'cosine':
      lines.push(`${outType('out')} ${outVar('out')} = cos(${getInputExpr('in')});`);
      break;
    case 'tangent':
      lines.push(`${outType('out')} ${outVar('out')} = tan(${getInputExpr('in')});`);
      break;
    case 'atan2':
      lines.push(`${outType('out')} ${outVar('out')} = ${atan2Fn}(${getInputExpr('a')}, ${getInputExpr('b')});`);
      break;
    case 'dot':
      lines.push(`float ${outVar('out')} = dot(${getInputExpr('a')}, ${getInputExpr('b')});`);
      break;
    case 'cross':
      lines.push(`${vec3} ${outVar('out')} = cross(${getInputExpr('a')}, ${getInputExpr('b')});`);
      break;
    case 'normalize':
      lines.push(`${outType('out')} ${outVar('out')} = normalize(${getInputExpr('in')});`);
      break;
    case 'length':
      lines.push(`float ${outVar('out')} = length(${getInputExpr('in')});`);
      break;
    case 'distance':
      lines.push(`float ${outVar('out')} = distance(${getInputExpr('a')}, ${getInputExpr('b')});`);
      break;

    // PROCEDURAL NODES
    case 'simple-noise':
      lines.push(
        `float ${outVar('out')} = sg_simpleNoise(${getInputExpr('uv')}, ${getInputExpr('scale')});`
      );
      break;
    case 'gradient-noise':
      lines.push(
        `float ${outVar('out')} = sg_gradientNoise(${getInputExpr('uv')}, ${getInputExpr('scale')});`
      );
      break;
    case 'voronoi':
      lines.push(
        `${vec2} ${outVar('_v')} = sg_voronoi(${getInputExpr('uv')}, ${getInputExpr('angleOffset')}, ${getInputExpr('cellDensity')});`
      );
      lines.push(`float ${outVar('out')} = ${outVar('_v')}.x;`);
      lines.push(`float ${outVar('cells')} = ${outVar('_v')}.y;`);
      break;
    case 'checkerboard':
      lines.push(
        `${vec3} ${outVar('out')} = sg_checkerboard(${getInputExpr('uv')}, ${getInputExpr('colorA')}, ${getInputExpr('colorB')}, ${getInputExpr('frequency')});`
      );
      break;
    case 'fresnel':
      lines.push(
        `float ${outVar('out')} = pow(1.0 - clamp(dot(normalize(${getInputExpr('normal')}), normalize(${getInputExpr('viewDir')})), 0.0, 1.0), max(${getInputExpr('power')}, 0.001));`
      );
      break;
    case 'ellipse':
      lines.push(
        `float ${outVar('out')} = sg_ellipse(${getInputExpr('uv')}, ${getInputExpr('width')}, ${getInputExpr('height')});`
      );
      break;
    case 'rounded-rectangle':
      lines.push(
        `float ${outVar('out')} = sg_roundedRectangle(${getInputExpr('uv')}, ${getInputExpr('width')}, ${getInputExpr('height')}, ${getInputExpr('radius')});`
      );
      break;
    case 'polygon':
      lines.push(
        `float ${outVar('out')} = sg_polygon(${getInputExpr('uv')}, ${getInputExpr('sides')}, ${getInputExpr('width')}, ${getInputExpr('height')});`
      );
      break;

    // UV NODES
    case 'tiling-and-offset':
      lines.push(
        `${vec2} ${outVar('out')} = (${getInputExpr('uv')}) * (${getInputExpr('tiling')}) + (${getInputExpr('offset')});`
      );
      break;
    case 'rotate': {
      const uv = getInputExpr('uv');
      const center = getInputExpr('center');
      const rot = getInputExpr('rotation');
      lines.push(`${vec2} ${outVar('_centered')} = (${uv}) - (${center});`);
      lines.push(`float ${outVar('_s')} = sin(${rot}); float ${outVar('_c')} = cos(${rot});`);
      lines.push(
        `${vec2} ${outVar('out')} = ${vec2}(${outVar('_centered')}.x * ${outVar('_c')} - ${outVar('_centered')}.y * ${outVar('_s')}, ${outVar('_centered')}.x * ${outVar('_s')} + ${outVar('_centered')}.y * ${outVar('_c')}) + (${center});`
      );
      break;
    }
    case 'polar-coordinates': {
      const uv = getInputExpr('uv');
      const center = getInputExpr('center');
      const rScale = getInputExpr('radialScale');
      const lScale = getInputExpr('lengthScale');
      lines.push(`${vec2} ${outVar('_delta')} = (${uv}) - (${center});`);
      lines.push(
        `float ${outVar('_radius')} = length(${outVar('_delta')}) * 2.0 * (${rScale});`
      );
      lines.push(
        `float ${outVar('_angle')} = (${atan2Fn}(${outVar('_delta')}.x, ${outVar('_delta')}.y) / 6.2831853 + 0.5) * (${lScale});`
      );
      lines.push(`${vec2} ${outVar('out')} = ${vec2}(${outVar('_radius')}, ${outVar('_angle')});`);
      break;
    }
    case 'twirl': {
      const uv = getInputExpr('uv');
      const center = getInputExpr('center');
      const strength = getInputExpr('strength');
      const offset = getInputExpr('offset');
      lines.push(`${vec2} ${outVar('_d')} = (${uv}) - (${center});`);
      lines.push(`float ${outVar('_ang')} = (${strength}) * length(${outVar('_d')});`);
      lines.push(`float ${outVar('_c')} = cos(${outVar('_ang')}); float ${outVar('_s')} = sin(${outVar('_ang')});`);
      lines.push(
        `${vec2} ${outVar('out')} = ${vec2}(${outVar('_c')} * ${outVar('_d')}.x - ${outVar('_s')} * ${outVar('_d')}.y, ${outVar('_s')} * ${outVar('_d')}.x + ${outVar('_c')} * ${outVar('_d')}.y) + (${center}) + (${offset});`
      );
      break;
    }
    case 'radial-shear': {
      const uv = getInputExpr('uv');
      const center = getInputExpr('center');
      const strength = getInputExpr('strength');
      const offset = getInputExpr('offset');
      lines.push(`${vec2} ${outVar('_d')} = (${uv}) - (${center});`);
      lines.push(`float ${outVar('_r2')} = dot(${outVar('_d')}, ${outVar('_d')});`);
      lines.push(
        `${vec2} ${outVar('out')} = (${uv}) + ${vec2}(${outVar('_d')}.y, -${outVar('_d')}.x) * (${strength}) * ${outVar('_r2')} + (${offset});`
      );
      break;
    }
    case 'spherize': {
      const uv = getInputExpr('uv');
      const center = getInputExpr('center');
      const strength = getInputExpr('strength');
      const offset = getInputExpr('offset');
      lines.push(`${vec2} ${outVar('_d')} = (${uv}) - (${center});`);
      lines.push(`float ${outVar('_r2')} = dot(${outVar('_d')}, ${outVar('_d')});`);
      lines.push(
        `${vec2} ${outVar('out')} = (${uv}) + ${outVar('_d')} * (${strength}) * (${outVar('_r2')} * ${outVar('_r2')}) + (${offset});`
      );
      break;
    }

    // CHANNEL NODES
    case 'split': {
      const inExpr = castExpr(getInputExpr('in'), res?.inputs['in'] || '4', '4', lang);
      lines.push(`${vec4} ${outVar('_v')} = ${inExpr};`);
      lines.push(`float ${outVar('r')} = ${outVar('_v')}.x;`);
      lines.push(`float ${outVar('g')} = ${outVar('_v')}.y;`);
      lines.push(`float ${outVar('b')} = ${outVar('_v')}.z;`);
      lines.push(`float ${outVar('a')} = ${outVar('_v')}.w;`);
      break;
    }
    case 'combine': {
      const r = getInputExpr('r');
      const g = getInputExpr('g');
      const b = getInputExpr('b');
      const a = getInputExpr('a');
      lines.push(`${vec4} ${outVar('rgba')} = ${vec4}(${r}, ${g}, ${b}, ${a});`);
      lines.push(`${vec3} ${outVar('rgb')} = ${vec3}(${r}, ${g}, ${b});`);
      lines.push(`${vec2} ${outVar('rg')} = ${vec2}(${r}, ${g});`);
      break;
    }
    case 'swizzle': {
      const rawMask = String(node.settings?.mask || 'zyxw')
        .toLowerCase()
        .replace(/[^xyzwrgba]/g, '')
        .slice(0, 4) || 'x';
      lines.push(`${outType('out')} ${outVar('out')} = (${getInputExpr('in')}).${rawMask};`);
      break;
    }

    // ARTISTIC NODES
    case 'blend': {
      const b = getInputExpr('base');
      const s = getInputExpr('blend');
      const op = getInputExpr('opacity');
      const mode = node.settings?.mode || 'Overlay';
      const d = res?.outputs['out'] || '3';
      const one = castExpr('1.0', '1', d, lang);
      const two = castExpr('2.0', '1', d, lang);
      const half = castExpr('0.5', '1', d, lang);
      let blended = `(${b}) * (${s})`;
      if (mode === 'Screen') {
        blended = `${one} - (${one} - (${b})) * (${one} - (${s}))`;
      } else if (mode === 'Overlay') {
        blended = `${mixFn}(${two} * (${b}) * (${s}), ${one} - ${two} * (${one} - (${b})) * (${one} - (${s})), step(${half}, ${b}))`;
      } else if (mode === 'Darken') {
        blended = `min(${b}, ${s})`;
      } else if (mode === 'Lighten') {
        blended = `max(${b}, ${s})`;
      } else if (mode === 'LinearDodge') {
        blended = `(${b}) + (${s})`;
      } else if (mode === 'Difference') {
        blended = `abs((${b}) - (${s}))`;
      } else if (mode === 'SoftLight') {
        blended = `${mixFn}(${two} * (${b}) * (${s}) + (${b}) * (${b}) * (${one} - ${two} * (${s})), sqrt(max(${b}, ${castExpr('0.0', '1', d, lang)})) * (${two} * (${s}) - ${one}) + ${two} * (${b}) * (${one} - (${s})), step(${half}, ${s}))`;
      }
      lines.push(
        `${outType('out')} ${outVar('out')} = ${mixFn}(${b}, ${blended}, ${castExpr(op, '1', d, lang)});`
      );
      break;
    }
    case 'hue': {
      lines.push(
        `${vec3} ${outVar('out')} = sg_hueNormalized(${getInputExpr('in')}, ${getInputExpr('offset')});`
      );
      break;
    }
    case 'saturation': {
      const col = getInputExpr('in');
      const sat = getInputExpr('saturation');
      lines.push(
        `float ${outVar('_luma')} = dot(${col}, ${vec3}(0.2126, 0.7152, 0.0722));`
      );
      lines.push(
        `${vec3} ${outVar('out')} = ${mixFn}(${vec3}(${outVar('_luma')}, ${outVar('_luma')}, ${outVar('_luma')}), ${col}, ${sat});`
      );
      break;
    }
    case 'contrast': {
      const col = getInputExpr('in');
      const con = getInputExpr('contrast');
      lines.push(
        `${vec3} ${outVar('out')} = ((${col}) - ${vec3}(0.5, 0.5, 0.5)) * (${con}) + ${vec3}(0.5, 0.5, 0.5);`
      );
      break;
    }
    case 'invert-colors': {
      const one = castExpr('1.0', '1', res?.outputs['out'] || '3', lang);
      lines.push(`${outType('out')} ${outVar('out')} = ${one} - (${getInputExpr('in')});`);
      break;
    }
    case 'replace-color': {
      const col = getInputExpr('in');
      const from = getInputExpr('from');
      const to = getInputExpr('to');
      const range = getInputExpr('range');
      const fuzz = getInputExpr('fuzziness');
      lines.push(
        `float ${outVar('_mask')} = clamp((distance(${col}, ${from}) - (${range})) / max(${fuzz}, 0.0001), 0.0, 1.0);`
      );
      lines.push(`${vec3} ${outVar('out')} = ${mixFn}(${to}, ${col}, ${outVar('_mask')});`);
      break;
    }
    case 'color-ramp': {
      const t = `clamp(${getInputExpr('time')}, 0.0, 1.0)`;
      const [r0, g0, b0, a0] = hexToRgbNormalized(node.settings?.color0 || '#0a192f');
      const [r1, g1, b1, a1] = hexToRgbNormalized(node.settings?.color1 || '#00b4d8');
      const [r2, g2, b2, a2] = hexToRgbNormalized(node.settings?.color2 || '#ffbe0b');
      const c0 = `${vec4}(${formatFloat(r0)}, ${formatFloat(g0)}, ${formatFloat(b0)}, ${formatFloat(a0)})`;
      const c1 = `${vec4}(${formatFloat(r1)}, ${formatFloat(g1)}, ${formatFloat(b1)}, ${formatFloat(a1)})`;
      const c2 = `${vec4}(${formatFloat(r2)}, ${formatFloat(g2)}, ${formatFloat(b2)}, ${formatFloat(a2)})`;
      lines.push(`float ${outVar('_t')} = ${t};`);
      lines.push(
        `${vec4} ${outVar('out')} = ${outVar('_t')} < 0.5 ? ${mixFn}(${c0}, ${c1}, ${outVar('_t')} * 2.0) : ${mixFn}(${c1}, ${c2}, (${outVar('_t')} - 0.5) * 2.0);`
      );
      break;
    }

    // UTILITY NODES
    case 'preview':
    case 'unknown-unity':
      lines.push(`${outType('out')} ${outVar('out')} = ${getInputExpr('in')};`);
      break;

    case 'comparison': {
      const a = getInputExpr('a');
      const b = getInputExpr('b');
      const cmp = node.settings?.comparison || 'Greater';
      let cond = `(${a}) > (${b})`;
      if (cmp === 'Equal') cond = `abs((${a}) - (${b})) < 0.0001`;
      else if (cmp === 'NotEqual') cond = `abs((${a}) - (${b})) >= 0.0001`;
      else if (cmp === 'Less') cond = `(${a}) < (${b})`;
      else if (cmp === 'LessOrEqual') cond = `(${a}) <= (${b})`;
      else if (cmp === 'GreaterOrEqual') cond = `(${a}) >= (${b})`;
      lines.push(`float ${outVar('out')} = (${cond}) ? 1.0 : 0.0;`);
      break;
    }

    case 'branch': {
      const pred = getInputExpr('predicate');
      const tVal = getInputExpr('true');
      const fVal = getInputExpr('false');
      lines.push(
        `${outType('out')} ${outVar('out')} = ((${pred}) > 0.5) ? (${tVal}) : (${fVal});`
      );
      break;
    }

    case 'custom-function': {
      const aExpr = getInputExpr('a');
      const bExpr = getInputExpr('b');
      let expr = String(node.settings?.expression || 'sin(A * B * 3.14159) * 0.5 + 0.5');
      if (lang === 'glsl') {
        expr = expr.replace(/\bfloat2\b/g, 'vec2').replace(/\bfloat3\b/g, 'vec3').replace(/\bfloat4\b/g, 'vec4').replace(/\blerp\b/g, 'mix').replace(/\bfrac\b/g, 'fract');
      } else {
        expr = expr.replace(/\bvec2\b/g, 'float2').replace(/\bvec3\b/g, 'float3').replace(/\bvec4\b/g, 'float4').replace(/\bmix\b/g, 'lerp').replace(/\bfract\b/g, 'frac');
      }
      lines.push(`{`);
      lines.push(`  ${vec3} A = ${aExpr};`);
      lines.push(`  float B = ${bExpr};`);
      lines.push(`  ${outVar('_cf')} = ${expr};`);
      lines.push(`}`);
      lines.unshift(`${vec3} ${outVar('_cf')} = ${vec3}(0.0, 0.0, 0.0);`);
      lines.push(`${vec3} ${outVar('out')} = ${outVar('_cf')};`);
      break;
    }

    default:
      for (const out of def.outputs) {
        lines.push(
          `${outType(out.id)} ${outVar(out.id)} = ${castExpr('0.0', '1', res?.outputs[out.id] || '1', lang)};`
        );
      }
      break;
  }

  return lines.join('\n  ');
}

/**
 * Compiles the graph (or a specific node for inline 2D preview) into WebGL GLSL shaders.
 */
export function compileToWebGL(
  project: ShaderGraphProject,
  previewTargetNodeId?: string
): CompiledWebGLShader {
  const { sortedNodes, portResolutions } = resolveGraphOrderAndPorts(project);
  const referencedTextures = new Set<string>();
  const errors: string[] = [];

  // Collect property uniforms
  const uniformDecls: string[] = [
    'uniform float uTime;',
    'uniform vec3 uLightDir;',
    'uniform vec3 uLightColor;',
    'uniform float uAmbientIntensity;',
  ];

  for (const prop of project.properties) {
    const uName = getPropertyUniformName(prop);
    if (prop.type === 'float' || prop.type === 'boolean') {
      uniformDecls.push(`uniform float ${uName};`);
    } else if (prop.type === 'vector2') {
      uniformDecls.push(`uniform vec2 ${uName};`);
    } else if (prop.type === 'vector3') {
      uniformDecls.push(`uniform vec3 ${uName};`);
    } else if (prop.type === 'vector4' || prop.type === 'color') {
      uniformDecls.push(`uniform vec4 ${uName};`);
    } else if (prop.type === 'texture2d') {
      referencedTextures.add(String(prop.value || 'uvgrid'));
    }
  }

  // Emit node code in topological order
  const bodyStatements: string[] = [];
  for (const node of sortedNodes) {
    if (node.typeId === 'master-lit') continue;
    const code = emitNodeCode(node, project, portResolutions, 'glsl', referencedTextures);
    if (code) {
      bodyStatements.push(`// [${node.typeId}] ${node.id}\n  ${code}`);
    }
    if (previewTargetNodeId && node.id === previewTargetNodeId) {
      break;
    }
  }

  for (const texKey of referencedTextures) {
    const safeTex = sanitizeIdentifier(texKey);
    uniformDecls.push(`uniform sampler2D uTex_${safeTex};`);
  }

  // If compiling for an individual node's inline 2D preview:
  if (previewTargetNodeId) {
    const targetNode = project.nodes.find((n) => n.id === previewTargetNodeId);
    const def = targetNode ? getNodeDefinition(targetNode, project.properties) : null;
    let previewColorExpr = 'vec4(0.5, 0.5, 0.5, 1.0)';

    if (targetNode && def) {
      if (targetNode.typeId === 'texture2d-asset') {
        const texKey = String(targetNode.settings?.textureKey || 'uvgrid');
        const safeTex = sanitizeIdentifier(texKey);
        previewColorExpr = `texture2D(uTex_${safeTex}, vUv)`;
      } else if (def.outputs.length > 0) {
        const firstOut = def.outputs[0];
        const varName = `n_${sanitizeIdentifier(targetNode.id)}_${sanitizeIdentifier(firstOut.id)}`;
        const outDim = portResolutions[targetNode.id]?.outputs[firstOut.id] || '1';
        if (outDim === '1' || outDim === 'boolean') {
          previewColorExpr = `vec4(vec3(${varName}), 1.0)`;
        } else if (outDim === '2') {
          previewColorExpr = `vec4(${varName}.xy, 0.0, 1.0)`;
        } else if (outDim === '3') {
          previewColorExpr = `vec4(${varName}.xyz, 1.0)`;
        } else {
          previewColorExpr = `vec4(${varName}.rgb, 1.0)`;
        }
      }
    }

    const vertexShader = `
varying vec2 vUv;
varying vec3 vPositionOS;
varying vec3 vPositionWS;
varying vec3 vPositionVS;
varying vec3 vNormalOS;
varying vec3 vNormalWS;
varying vec3 vTangentWS;
varying vec3 vViewDirWS;
varying vec4 vColor;

void main() {
  vUv = uv;
  // Emulate a virtual sphere surface on the 2D quad for 3D-dependent nodes (Fresnel, Normal, Position)
  vec2 p = uv * 2.0 - 1.0;
  float r2 = dot(p, p);
  float z = sqrt(max(0.0, 1.0 - min(r2, 1.0)));
  vec3 sphereN = normalize(vec3(p.x, p.y, z + 0.15));
  vPositionOS = vec3(p, z);
  vPositionWS = vec3(p, z);
  vPositionVS = vec3(p, z);
  vNormalOS = sphereN;
  vNormalWS = sphereN;
  vTangentWS = normalize(vec3(1.0, 0.0, 0.0));
  vViewDirWS = vec3(0.0, 0.0, 1.0);
  vColor = vec4(uv.x, uv.y, 1.0 - uv.x, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

    const fragmentShader = `
precision highp float;
varying vec2 vUv;
varying vec3 vPositionOS;
varying vec3 vPositionWS;
varying vec3 vPositionVS;
varying vec3 vNormalOS;
varying vec3 vNormalWS;
varying vec3 vTangentWS;
varying vec3 vViewDirWS;
varying vec4 vColor;

${uniformDecls.join('\n')}
${GLSL_HELPER_FUNCTIONS}

void main() {
  ${bodyStatements.join('\n  ')}
  gl_FragColor = ${previewColorExpr};
}
`;

    return {
      vertexShader,
      fragmentShader,
      portResolutions,
      referencedTextures: Array.from(referencedTextures),
      errors,
    };
  }

  // Otherwise compile Master Stack for 3D Main Preview
  const masterNode =
    project.nodes.find((n) => n.typeId === 'master-lit') || project.nodes[0];
  const masterDef = masterNode ? getNodeDefinition(masterNode, project.properties) : null;

  const getMasterInput = (portId: string, targetDim: ResolvedPortType): string => {
    if (!masterNode || !masterDef) return castExpr('0.0', '1', targetDim, 'glsl');
    const port = masterDef.inputs.find((p) => p.id === portId);
    const edge = project.edges.find(
      (e) => e.targetNodeId === masterNode.id && e.targetPortId === portId
    );
    if (edge) {
      const srcVar = `n_${sanitizeIdentifier(edge.sourceNodeId)}_${sanitizeIdentifier(
        edge.sourcePortId
      )}`;
      const srcDim =
        portResolutions[edge.sourceNodeId]?.outputs[edge.sourcePortId] || '1';
      return castExpr(srcVar, srcDim, targetDim, 'glsl');
    }
    if (!port) return castExpr('0.0', '1', targetDim, 'glsl');
    return formatDefaultLiteral(port, masterNode.inputValues?.[portId], targetDim, 'glsl');
  };

  const hasVertexDisplacement = Boolean(
    masterNode &&
      project.edges.some(
        (e) => e.targetNodeId === masterNode.id && e.targetPortId === 'vertexPosition'
      )
  );

  const vertexPosExpr = hasVertexDisplacement
    ? getMasterInput('vertexPosition', '3')
    : 'position';

  const vertexShader = `
varying vec2 vUv;
varying vec3 vPositionOS;
varying vec3 vPositionWS;
varying vec3 vPositionVS;
varying vec3 vNormalOS;
varying vec3 vNormalWS;
varying vec3 vTangentWS;
varying vec3 vViewDirWS;
varying vec4 vColor;

${uniformDecls.join('\n')}
${GLSL_HELPER_FUNCTIONS}

void main() {
  vUv = uv;
  vPositionOS = position;
  vNormalOS = normal;
  vNormalWS = normalize(mat3(modelMatrix) * normal);
  vTangentWS = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
  vec4 worldPosInitial = modelMatrix * vec4(position, 1.0);
  vPositionWS = worldPosInitial.xyz;
  vPositionVS = (modelViewMatrix * vec4(position, 1.0)).xyz;
  vViewDirWS = normalize(cameraPosition - worldPosInitial.xyz);
  vColor = vec4(uv.x, uv.y, 1.0, 1.0);

  ${hasVertexDisplacement ? bodyStatements.join('\n  ') : ''}
  vec3 displacedPos = ${vertexPosExpr};
  vec4 finalWorldPos = modelMatrix * vec4(displacedPos, 1.0);
  vPositionWS = finalWorldPos.xyz;
  vViewDirWS = normalize(cameraPosition - finalWorldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * finalWorldPos;
}
`;

  const baseColorExpr = getMasterInput('baseColor', '4');
  const normalTSExpr = getMasterInput('normal', '3');
  const metallicExpr = getMasterInput('metallic', '1');
  const smoothnessExpr = getMasterInput('smoothness', '1');
  const emissionExpr = getMasterInput('emission', '4');
  const occlusionExpr = getMasterInput('occlusion', '1');
  const alphaExpr = getMasterInput('alpha', '1');
  const alphaClipThresholdExpr = getMasterInput('alphaClipThreshold', '1');

  const isUnlit = project.settings.subTarget === 'Unlit';
  const alphaClipCode = project.settings.alphaClip
    ? `if (surfAlpha < (${alphaClipThresholdExpr})) discard;`
    : '';

  const fragmentShader = `
precision highp float;
varying vec2 vUv;
varying vec3 vPositionOS;
varying vec3 vPositionWS;
varying vec3 vPositionVS;
varying vec3 vNormalOS;
varying vec3 vNormalWS;
varying vec3 vTangentWS;
varying vec3 vViewDirWS;
varying vec4 vColor;

${uniformDecls.join('\n')}
${GLSL_HELPER_FUNCTIONS}

void main() {
  ${bodyStatements.join('\n  ')}

  vec3 baseCol = (${baseColorExpr}).rgb;
  vec3 normalTS = ${normalTSExpr};
  float metallic = clamp(${metallicExpr}, 0.0, 1.0);
  float smoothness = clamp(${smoothnessExpr}, 0.0, 1.0);
  vec3 emission = (${emissionExpr}).rgb;
  float ao = clamp(${occlusionExpr}, 0.0, 1.0);
  float surfAlpha = clamp(${alphaExpr}, 0.0, 1.0);

  ${alphaClipCode}

  ${
    isUnlit
      ? `gl_FragColor = vec4(baseCol + emission, surfAlpha);`
      : `
  // Construct TBN & perturbed normal
  vec3 N = normalize(vNormalWS);
  vec3 T = normalize(vTangentWS - N * dot(vTangentWS, N));
  vec3 B = cross(N, T);
  mat3 TBN = mat3(T, B, N);
  vec3 finalN = normalize(mix(N, TBN * normalize(normalTS), 0.65));

  vec3 V = normalize(vViewDirWS);
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(V + L);

  float NdotL = max(dot(finalN, L), 0.0);
  float NdotV = max(dot(finalN, V), 0.001);
  float NdotH = max(dot(finalN, H), 0.0);

  // Physically-inspired URP Lit approximation (Diffuse + GGX Specular + Hemisphere Ambient + Rim)
  vec3 f0 = mix(vec3(0.04), baseCol, metallic);
  vec3 diffuseColor = baseCol * (1.0 - metallic);
  float roughness = max(1.0 - smoothness, 0.04);
  float specPower = exp2(10.0 * smoothness + 1.0);
  float spec = pow(NdotH, specPower) * (smoothness * 1.6 + 0.15);
  vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - NdotV, 5.0);

  vec3 skyCol = vec3(0.36, 0.44, 0.58) * uAmbientIntensity;
  vec3 groundCol = vec3(0.14, 0.15, 0.18) * uAmbientIntensity;
  vec3 ambient = mix(groundCol, skyCol, finalN.y * 0.5 + 0.5) * diffuseColor * ao;

  vec3 direct = (diffuseColor * NdotL + fresnel * spec * NdotL) * uLightColor;
  vec3 envRefl = mix(groundCol, skyCol * 1.4, reflect(-V, finalN).y * 0.5 + 0.5) * fresnel * smoothness * ao;

  vec3 finalRGB = ambient + direct + envRefl + emission;
  gl_FragColor = vec4(finalRGB, surfAlpha);
  `
  }
}
`;

  return {
    vertexShader,
    fragmentShader,
    portResolutions,
    referencedTextures: Array.from(referencedTextures),
    errors,
  };
}

/**
 * Compiles the ShaderGraphProject into a standalone Unity URP ShaderLab (.shader) file with HLSL.
 */
export function compileToUnityShaderLab(project: ShaderGraphProject): string {
  const { sortedNodes, portResolutions } = resolveGraphOrderAndPorts(project);
  const referencedTextures = new Set<string>();

  const hlslBody: string[] = [];
  for (const node of sortedNodes) {
    if (node.typeId === 'master-lit') continue;
    const code = emitNodeCode(node, project, portResolutions, 'hlsl', referencedTextures);
    if (code) {
      hlslBody.push(`// [${node.typeId}] ${node.id}\n                ${code.replace(/\n  /g, '\n                ')}`);
    }
  }

  const masterNode =
    project.nodes.find((n) => n.typeId === 'master-lit') || project.nodes[0];
  const masterDef = masterNode ? getNodeDefinition(masterNode, project.properties) : null;

  const getMasterInputHLSL = (portId: string, targetDim: ResolvedPortType): string => {
    if (!masterNode || !masterDef) return castExpr('0.0', '1', targetDim, 'hlsl');
    const port = masterDef.inputs.find((p) => p.id === portId);
    const edge = project.edges.find(
      (e) => e.targetNodeId === masterNode.id && e.targetPortId === portId
    );
    if (edge) {
      const srcVar = `n_${sanitizeIdentifier(edge.sourceNodeId)}_${sanitizeIdentifier(
        edge.sourcePortId
      )}`;
      const srcDim =
        portResolutions[edge.sourceNodeId]?.outputs[edge.sourcePortId] || '1';
      return castExpr(srcVar, srcDim, targetDim, 'hlsl');
    }
    if (!port) return castExpr('0.0', '1', targetDim, 'hlsl');
    return formatDefaultLiteral(port, masterNode.inputValues?.[portId], targetDim, 'hlsl');
  };

  // ShaderLab Properties block
  const shaderProps: string[] = [];
  const cbufferVars: string[] = [];
  const textureDecls: string[] = [];

  for (const prop of project.properties) {
    const uName = getPropertyUniformName(prop);
    if (prop.type === 'float') {
      const defVal = formatFloat(prop.value, 0);
      if (prop.mode === 'Slider') {
        shaderProps.push(
          `        ${uName}("${prop.name}", Range(${formatFloat(prop.rangeMin, 0)}, ${formatFloat(
            prop.rangeMax,
            1
          )})) = ${defVal}`
        );
      } else {
        shaderProps.push(`        ${uName}("${prop.name}", Float) = ${defVal}`);
      }
      cbufferVars.push(`            float ${uName};`);
    } else if (prop.type === 'boolean') {
      shaderProps.push(`        [Toggle] ${uName}("${prop.name}", Float) = ${prop.value ? 1 : 0}`);
      cbufferVars.push(`            float ${uName};`);
    } else if (prop.type === 'color') {
      const [r, g, b, a] = hexToRgbNormalized(prop.value || '#ffffff');
      const hdrTag = prop.mode === 'HDR' ? '[HDR] ' : '';
      shaderProps.push(
        `        ${hdrTag}${uName}("${prop.name}", Color) = (${formatFloat(r)}, ${formatFloat(
          g
        )}, ${formatFloat(b)}, ${formatFloat(a)})`
      );
      cbufferVars.push(`            float4 ${uName};`);
    } else if (prop.type === 'vector2' || prop.type === 'vector3' || prop.type === 'vector4') {
      const arr = Array.isArray(prop.value) ? prop.value : [0, 0, 0, 0];
      shaderProps.push(
        `        ${uName}("${prop.name}", Vector) = (${formatFloat(arr[0], 0)}, ${formatFloat(
          arr[1],
          0
        )}, ${formatFloat(arr[2], 0)}, ${formatFloat(arr[3], 0)})`
      );
      cbufferVars.push(`            ${hlslType(prop.type === 'vector2' ? '2' : prop.type === 'vector3' ? '3' : '4')} ${uName};`);
    } else if (prop.type === 'texture2d') {
      shaderProps.push(`        ${uName}("${prop.name}", 2D) = "white" {}`);
      referencedTextures.add(String(prop.value || 'uvgrid'));
    }
  }

  for (const texKey of referencedTextures) {
    const safeTex = sanitizeIdentifier(texKey);
    shaderProps.push(`        _Tex_${safeTex}("Texture ${texKey}", 2D) = "white" {}`);
    textureDecls.push(`        TEXTURE2D(_Tex_${safeTex});`);
    textureDecls.push(`        SAMPLER(sampler_Tex_${safeTex});`);
  }

  const hlslHelpers = GLSL_HELPER_FUNCTIONS.replace(/\bvec2\b/g, 'float2')
    .replace(/\bvec3\b/g, 'float3')
    .replace(/\bvec4\b/g, 'float4')
    .replace(/\bmat2\b/g, 'float2x2')
    .replace(/\bmix\b/g, 'lerp')
    .replace(/\bfract\b/g, 'frac')
    .replace(/\bmod\b/g, 'fmod')
    .replace(/\batan\(/g, 'atan2(');

  const isTransparent = project.settings.surfaceType === 'Transparent';
  const cullMode =
    project.settings.renderFace === 'Front'
      ? 'Back'
      : project.settings.renderFace === 'Back'
      ? 'Front'
      : 'Off';
  const blendLine = isTransparent ? 'Blend SrcAlpha OneMinusSrcAlpha' : 'Blend One Zero';
  const zWriteLine = isTransparent ? 'ZWrite Off' : 'ZWrite On';
  const renderQueue = isTransparent ? 'Transparent' : project.settings.alphaClip ? 'AlphaTest' : 'Geometry';
  const renderType = isTransparent ? 'Transparent' : project.settings.alphaClip ? 'TransparentCutout' : 'Opaque';

  const safeShaderName = project.name.replace(/"/g, '') || 'CustomShaderGraph';

  return `Shader "ShaderGraphWeb/${safeShaderName}"
{
    Properties
    {
${shaderProps.join('\n')}
    }
    SubShader
    {
        Tags
        {
            "RenderPipeline" = "UniversalPipeline"
            "RenderType" = "${renderType}"
            "Queue" = "${renderQueue}"
        }

        Pass
        {
            Name "UniversalForward"
            Tags { "LightMode" = "UniversalForward" }

            Cull ${cullMode}
            ${blendLine}
            ${zWriteLine}

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            CBUFFER_START(UnityPerMaterial)
${cbufferVars.join('\n')}
            CBUFFER_END

${textureDecls.join('\n')}

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
                float4 tangentOS  : TANGENT;
                float2 uv         : TEXCOORD0;
                float4 color      : COLOR;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float2 vUv        : TEXCOORD0;
                float3 vPositionOS: TEXCOORD1;
                float3 vPositionWS: TEXCOORD2;
                float3 vPositionVS: TEXCOORD3;
                float3 vNormalOS  : TEXCOORD4;
                float3 vNormalWS  : TEXCOORD5;
                float3 vTangentWS : TEXCOORD6;
                float3 vViewDirWS : TEXCOORD7;
                float4 vColor     : COLOR;
            };

${hlslHelpers}

            Varyings vert(Attributes input)
            {
                Varyings output;
                float uTime = _Time.y;
                output.vUv = input.uv;
                output.vPositionOS = input.positionOS.xyz;
                output.vPositionWS = TransformObjectToWorld(input.positionOS.xyz);
                output.vPositionVS = TransformWorldToView(output.vPositionWS);
                output.vNormalOS = input.normalOS;
                output.vNormalWS = TransformObjectToWorldNormal(input.normalOS);
                output.vTangentWS = TransformObjectToWorldDir(input.tangentOS.xyz);
                output.vViewDirWS = GetWorldSpaceNormalizeViewDir(output.vPositionWS);
                output.vColor = input.color;

                float2 vUv = output.vUv;
                float3 vPositionOS = output.vPositionOS;
                float3 vPositionWS = output.vPositionWS;
                float3 vPositionVS = output.vPositionVS;
                float3 vNormalOS = output.vNormalOS;
                float3 vNormalWS = output.vNormalWS;
                float3 vTangentWS = output.vTangentWS;
                float3 vViewDirWS = output.vViewDirWS;
                float4 vColor = output.vColor;

                output.positionCS = TransformWorldToHClip(output.vPositionWS);
                return output;
            }

            half4 frag(Varyings input) : SV_Target
            {
                float uTime = _Time.y;
                float2 vUv = input.vUv;
                float3 vPositionOS = input.vPositionOS;
                float3 vPositionWS = input.vPositionWS;
                float3 vPositionVS = input.vPositionVS;
                float3 vNormalOS = input.vNormalOS;
                float3 vNormalWS = normalize(input.vNormalWS);
                float3 vTangentWS = normalize(input.vTangentWS);
                float3 vViewDirWS = normalize(input.vViewDirWS);
                float4 vColor = input.vColor;

                ${hlslBody.join('\n                ')}

                float3 baseColor = (${getMasterInputHLSL('baseColor', '4')}).rgb;
                float3 normalTS = ${getMasterInputHLSL('normal', '3')};
                float metallic = saturate(${getMasterInputHLSL('metallic', '1')});
                float smoothness = saturate(${getMasterInputHLSL('smoothness', '1')});
                float3 emission = (${getMasterInputHLSL('emission', '4')}).rgb;
                float occlusion = saturate(${getMasterInputHLSL('occlusion', '1')});
                float alpha = saturate(${getMasterInputHLSL('alpha', '1')});
                float alphaClipThreshold = ${getMasterInputHLSL('alphaClipThreshold', '1')};

                ${project.settings.alphaClip ? 'clip(alpha - alphaClipThreshold);' : ''}

                ${
                  project.settings.subTarget === 'Unlit'
                    ? 'return half4(baseColor + emission, alpha);'
                    : `Light mainLight = GetMainLight();
                float NdotL = saturate(dot(vNormalWS, mainLight.direction));
                float3 litColor = baseColor * (mainLight.color * NdotL + SampleSH(vNormalWS) * occlusion) + emission;
                return half4(litColor, alpha);`
                }
            }
            ENDHLSL
        }
    }
}
`;
}
