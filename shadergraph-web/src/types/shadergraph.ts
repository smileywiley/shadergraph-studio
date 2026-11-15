export type PortDataType =
  | '1'          // Float
  | '2'          // Vector2
  | '3'          // Vector3
  | '4'          // Vector4
  | 'dynamic'    // Dynamic Vector (adapts 1..4 based on connected inputs)
  | 'color'      // Color (RGBA / RGB, treated as 4/3)
  | 'texture2d'  // Texture2D Asset
  | 'sampler'    // SamplerState
  | 'boolean';   // Boolean

export type ResolvedPortType = '1' | '2' | '3' | '4' | 'color' | 'texture2d' | 'sampler' | 'boolean';

export type ImplicitBinding =
  | 'none'
  | 'uv0'
  | 'positionOS'
  | 'positionWS'
  | 'normalWS'
  | 'normalOS'
  | 'tangentWS'
  | 'viewDirWS'
  | 'viewDirTS'
  | 'vertexColor'
  | 'time';

export interface PortDefinition {
  id: string;
  name: string;
  slotId: number; // Unity ShaderGraph numeric slot ID
  direction: 'input' | 'output';
  type: PortDataType;
  defaultValue?: number | number[] | string | boolean;
  binding?: ImplicitBinding;
  stage?: 'vertex' | 'fragment' | 'both';
}

export type NodeCategory =
  | 'Input'
  | 'Math'
  | 'Procedural'
  | 'Artistic'
  | 'Channel'
  | 'UV'
  | 'Utility'
  | 'Master';

export interface NodeSettingChoice {
  label: string;
  value: string;
}

export interface NodeSettingDefinition {
  key: string;
  label: string;
  type: 'select' | 'text' | 'textarea' | 'color' | 'texture' | 'number' | 'boolean' | 'swizzle';
  defaultValue: any;
  options?: NodeSettingChoice[];
}

export interface NodeDefinition {
  typeId: string;
  unityType: string; // e.g. "UnityEditor.ShaderGraph.AddNode"
  title: string;
  category: NodeCategory;
  subcategory?: string;
  description: string;
  synonyms?: string[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  settings?: NodeSettingDefinition[];
  hasPreview?: boolean;
  isMaster?: boolean;
}

export interface GraphNode {
  id: string;
  typeId: string;
  position: { x: number; y: number };
  previewExpanded: boolean;
  collapsed?: boolean;
  inputValues: Record<string, any>;
  settings: Record<string, any>;
  /** Present when node is an instance of a Blackboard Property */
  propertyId?: string;
  /** Preserved raw Unity node JSON when importing an unrecognized node */
  unknownUnityData?: {
    unityType: string;
    title: string;
    rawJson?: Record<string, any>;
  };
}

export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

export type BlackboardPropertyType =
  | 'float'
  | 'vector2'
  | 'vector3'
  | 'vector4'
  | 'color'
  | 'texture2d'
  | 'boolean';

export interface BlackboardProperty {
  id: string;
  name: string;
  referenceName: string; // e.g. "_BaseColor"
  type: BlackboardPropertyType;
  value: any;
  exposed: boolean;
  mode?: 'Default' | 'Slider' | 'HDR';
  rangeMin?: number;
  rangeMax?: number;
}

export interface GraphGroup {
  id: string;
  title: string;
  color: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface StickyNote {
  id: string;
  title: string;
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  theme: 'dark' | 'amber' | 'teal';
}

export interface GraphSettings {
  pipeline: 'URP';
  subTarget: 'Lit' | 'Unlit';
  surfaceType: 'Opaque' | 'Transparent';
  blendMode: 'Alpha' | 'Premultiply' | 'Additive' | 'Multiply';
  renderFace: 'Front' | 'Back' | 'Both';
  alphaClip: boolean;
  alphaClipThreshold: number;
  castShadows: boolean;
}

export interface ShaderGraphProject {
  id: string;
  name: string;
  description?: string;
  updatedAt: number;
  settings: GraphSettings;
  nodes: GraphNode[];
  edges: GraphEdge[];
  properties: BlackboardProperty[];
  groups: GraphGroup[];
  stickyNotes: StickyNote[];
}

export type PreviewMeshType = 'sphere' | 'cube' | 'quad' | 'torus' | 'cylinder' | 'knot';
export type EnvironmentPreset = 'studio' | 'sunset' | 'cyber' | 'neutral';
