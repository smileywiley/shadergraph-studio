import { NodeDefinition, GraphNode, BlackboardProperty, PortDefinition } from '../types/shadergraph';

export const NODE_DEFINITIONS: NodeDefinition[] = [
  // ==========================================
  // MASTER STACKS
  // ==========================================
  {
    typeId: 'master-lit',
    unityType: 'UnityEditor.ShaderGraph.BlockNode',
    title: 'URP Lit Master Stack',
    category: 'Master',
    description: 'Universal Render Pipeline Physically Based (Lit) Vertex & Fragment output stack.',
    isMaster: true,
    hasPreview: false,
    inputs: [
      { id: 'vertexPosition', name: 'Vertex Position', slotId: 0, direction: 'input', type: '3', binding: 'positionOS', stage: 'vertex' },
      { id: 'vertexNormal', name: 'Vertex Normal', slotId: 1, direction: 'input', type: '3', binding: 'normalOS', stage: 'vertex' },
      { id: 'vertexTangent', name: 'Vertex Tangent', slotId: 2, direction: 'input', type: '3', binding: 'tangentWS', stage: 'vertex' },
      { id: 'baseColor', name: 'Base Color', slotId: 3, direction: 'input', type: 'color', defaultValue: '#4ca6ff', stage: 'fragment' },
      { id: 'normal', name: 'Normal (Tangent)', slotId: 4, direction: 'input', type: '3', defaultValue: [0, 0, 1], stage: 'fragment' },
      { id: 'metallic', name: 'Metallic', slotId: 5, direction: 'input', type: '1', defaultValue: 0.1, stage: 'fragment' },
      { id: 'smoothness', name: 'Smoothness', slotId: 6, direction: 'input', type: '1', defaultValue: 0.65, stage: 'fragment' },
      { id: 'emission', name: 'Emission', slotId: 7, direction: 'input', type: 'color', defaultValue: '#000000', stage: 'fragment' },
      { id: 'occlusion', name: 'Ambient Occlusion', slotId: 8, direction: 'input', type: '1', defaultValue: 1.0, stage: 'fragment' },
      { id: 'alpha', name: 'Alpha', slotId: 9, direction: 'input', type: '1', defaultValue: 1.0, stage: 'fragment' },
      { id: 'alphaClipThreshold', name: 'Alpha Clip Threshold', slotId: 10, direction: 'input', type: '1', defaultValue: 0.5, stage: 'fragment' },
    ],
    outputs: [],
  },

  // ==========================================
  // INPUT NODES
  // ==========================================
  {
    typeId: 'time',
    unityType: 'UnityEditor.ShaderGraph.TimeNode',
    title: 'Time',
    category: 'Input',
    subcategory: 'Scene',
    description: 'Provides animated time values from Unity / WebGL render loop.',
    synonyms: ['clock', 'seconds', 'delta', 'animate'],
    hasPreview: false,
    inputs: [],
    outputs: [
      { id: 'time', name: 'Time (1)', slotId: 0, direction: 'output', type: '1' },
      { id: 'sineTime', name: 'Sine Time (1)', slotId: 1, direction: 'output', type: '1' },
      { id: 'cosineTime', name: 'Cosine Time (1)', slotId: 2, direction: 'output', type: '1' },
      { id: 'deltaTime', name: 'Delta Time (1)', slotId: 3, direction: 'output', type: '1' },
      { id: 'smoothDelta', name: 'Smooth Delta (1)', slotId: 4, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'uv',
    unityType: 'UnityEditor.ShaderGraph.UVNode',
    title: 'UV',
    category: 'Input',
    subcategory: 'Geometry',
    description: 'Mesh texture coordinates (UV0..UV3).',
    synonyms: ['texcoord', 'coordinates'],
    hasPreview: true,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '4' },
    ],
    settings: [
      {
        key: 'channel',
        label: 'Channel',
        type: 'select',
        defaultValue: 'UV0',
        options: [
          { label: 'UV0', value: 'UV0' },
          { label: 'UV1', value: 'UV1' },
        ],
      },
    ],
  },
  {
    typeId: 'position',
    unityType: 'UnityEditor.ShaderGraph.PositionNode',
    title: 'Position',
    category: 'Input',
    subcategory: 'Geometry',
    description: 'Accesses vertex or fragment position in the chosen coordinate space.',
    synonyms: ['world', 'object', 'vertex', 'coords'],
    hasPreview: true,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '3' },
    ],
    settings: [
      {
        key: 'space',
        label: 'Space',
        type: 'select',
        defaultValue: 'World',
        options: [
          { label: 'Object', value: 'Object' },
          { label: 'World', value: 'World' },
          { label: 'View', value: 'View' },
          { label: 'Tangent', value: 'Tangent' },
        ],
      },
    ],
  },
  {
    typeId: 'normal-vector',
    unityType: 'UnityEditor.ShaderGraph.NormalVectorNode',
    title: 'Normal Vector',
    category: 'Input',
    subcategory: 'Geometry',
    description: 'Mesh surface normal vector in Object, World, View, or Tangent space.',
    synonyms: ['normal', 'surface'],
    hasPreview: true,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '3' },
    ],
    settings: [
      {
        key: 'space',
        label: 'Space',
        type: 'select',
        defaultValue: 'World',
        options: [
          { label: 'Object', value: 'Object' },
          { label: 'World', value: 'World' },
          { label: 'View', value: 'View' },
          { label: 'Tangent', value: 'Tangent' },
        ],
      },
    ],
  },
  {
    typeId: 'view-direction',
    unityType: 'UnityEditor.ShaderGraph.ViewDirectionNode',
    title: 'View Direction',
    category: 'Input',
    subcategory: 'Geometry',
    description: 'Normalized vector from the surface point toward the camera.',
    synonyms: ['camera', 'eye', 'view'],
    hasPreview: true,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '3' },
    ],
    settings: [
      {
        key: 'space',
        label: 'Space',
        type: 'select',
        defaultValue: 'World',
        options: [
          { label: 'Object', value: 'Object' },
          { label: 'World', value: 'World' },
          { label: 'View', value: 'View' },
          { label: 'Tangent', value: 'Tangent' },
        ],
      },
    ],
  },
  {
    typeId: 'vertex-color',
    unityType: 'UnityEditor.ShaderGraph.VertexColorNode',
    title: 'Vertex Color',
    category: 'Input',
    subcategory: 'Geometry',
    description: 'Vertex color attribute bound to the mesh.',
    hasPreview: true,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '4' },
    ],
  },
  {
    typeId: 'screen-position',
    unityType: 'UnityEditor.ShaderGraph.ScreenPositionNode',
    title: 'Screen Position',
    category: 'Input',
    subcategory: 'Geometry',
    description: 'Normalized screen-space coordinates of the current fragment.',
    hasPreview: true,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '4' },
    ],
    settings: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        defaultValue: 'Default',
        options: [
          { label: 'Default', value: 'Default' },
          { label: 'Raw', value: 'Raw' },
          { label: 'Center', value: 'Center' },
          { label: 'Tiled', value: 'Tiled' },
        ],
      },
    ],
  },
  {
    typeId: 'float',
    unityType: 'UnityEditor.ShaderGraph.Vector1Node',
    title: 'Float',
    category: 'Input',
    subcategory: 'Basic',
    description: 'Constant scalar Float (Vector1) value.',
    synonyms: ['vector1', 'number', 'scalar', 'constant'],
    hasPreview: false,
    inputs: [
      { id: 'x', name: 'X', slotId: 1, direction: 'input', type: '1', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'slider',
    unityType: 'UnityEditor.ShaderGraph.SliderNode',
    title: 'Slider',
    category: 'Input',
    subcategory: 'Basic',
    description: 'Float value constrained between a minimum and maximum slider range.',
    hasPreview: false,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '1' },
    ],
    settings: [
      { key: 'value', label: 'Value', type: 'number', defaultValue: 0.5 },
      { key: 'min', label: 'Min', type: 'number', defaultValue: 0 },
      { key: 'max', label: 'Max', type: 'number', defaultValue: 1 },
    ],
  },
  {
    typeId: 'vector2',
    unityType: 'UnityEditor.ShaderGraph.Vector2Node',
    title: 'Vector 2',
    category: 'Input',
    subcategory: 'Basic',
    description: '2-component vector (X, Y).',
    synonyms: ['vec2', 'float2'],
    hasPreview: false,
    inputs: [
      { id: 'x', name: 'X', slotId: 1, direction: 'input', type: '1', defaultValue: 1.0 },
      { id: 'y', name: 'Y', slotId: 2, direction: 'input', type: '1', defaultValue: 1.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '2' },
    ],
  },
  {
    typeId: 'vector3',
    unityType: 'UnityEditor.ShaderGraph.Vector3Node',
    title: 'Vector 3',
    category: 'Input',
    subcategory: 'Basic',
    description: '3-component vector (X, Y, Z).',
    synonyms: ['vec3', 'float3'],
    hasPreview: false,
    inputs: [
      { id: 'x', name: 'X', slotId: 1, direction: 'input', type: '1', defaultValue: 0.0 },
      { id: 'y', name: 'Y', slotId: 2, direction: 'input', type: '1', defaultValue: 1.0 },
      { id: 'z', name: 'Z', slotId: 3, direction: 'input', type: '1', defaultValue: 0.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '3' },
    ],
  },
  {
    typeId: 'vector4',
    unityType: 'UnityEditor.ShaderGraph.Vector4Node',
    title: 'Vector 4',
    category: 'Input',
    subcategory: 'Basic',
    description: '4-component vector (X, Y, Z, W).',
    synonyms: ['vec4', 'float4'],
    hasPreview: false,
    inputs: [
      { id: 'x', name: 'X', slotId: 1, direction: 'input', type: '1', defaultValue: 0.0 },
      { id: 'y', name: 'Y', slotId: 2, direction: 'input', type: '1', defaultValue: 0.0 },
      { id: 'z', name: 'Z', slotId: 3, direction: 'input', type: '1', defaultValue: 0.0 },
      { id: 'w', name: 'W', slotId: 4, direction: 'input', type: '1', defaultValue: 1.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '4' },
    ],
  },
  {
    typeId: 'color',
    unityType: 'UnityEditor.ShaderGraph.ColorNode',
    title: 'Color',
    category: 'Input',
    subcategory: 'Basic',
    description: 'RGBA Color picker node with optional HDR intensity multiplier.',
    synonyms: ['rgb', 'rgba', 'tint', 'swatch'],
    hasPreview: true,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '4' },
    ],
    settings: [
      { key: 'color', label: 'Color', type: 'color', defaultValue: '#00d2ff' },
      { key: 'intensity', label: 'HDR Intensity', type: 'number', defaultValue: 1.0 },
    ],
  },
  {
    typeId: 'constant',
    unityType: 'UnityEditor.ShaderGraph.ConstantNode',
    title: 'Constant',
    category: 'Input',
    subcategory: 'Basic',
    description: 'Mathematical constants: PI, TAU (2*PI), PHI, E, SQRT2.',
    synonyms: ['pi', 'tau', 'euler', 'math'],
    hasPreview: false,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '1' },
    ],
    settings: [
      {
        key: 'constant',
        label: 'Constant',
        type: 'select',
        defaultValue: 'PI',
        options: [
          { label: 'PI (3.14159)', value: 'PI' },
          { label: 'TAU (6.28318)', value: 'TAU' },
          { label: 'PHI (1.61803)', value: 'PHI' },
          { label: 'E (2.71828)', value: 'E' },
          { label: 'SQRT2 (1.41421)', value: 'SQRT2' },
        ],
      },
    ],
  },
  {
    typeId: 'boolean',
    unityType: 'UnityEditor.ShaderGraph.BooleanNode',
    title: 'Boolean',
    category: 'Input',
    subcategory: 'Basic',
    description: 'True / False boolean value for Branch nodes.',
    hasPreview: false,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: 'boolean' },
    ],
    settings: [
      { key: 'value', label: 'Value', type: 'boolean', defaultValue: true },
    ],
  },
  {
    typeId: 'texture2d-asset',
    unityType: 'UnityEditor.ShaderGraph.Texture2DAssetNode',
    title: 'Texture 2D Asset',
    category: 'Input',
    subcategory: 'Texture',
    description: 'Selects a built-in procedural preset texture or custom uploaded image.',
    synonyms: ['image', 'bitmap', 'albedo', 'normalmap'],
    hasPreview: true,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: 'texture2d' },
    ],
    settings: [
      {
        key: 'textureKey',
        label: 'Texture',
        type: 'texture',
        defaultValue: 'uvgrid',
        options: [
          { label: 'UV Checker Grid', value: 'uvgrid' },
          { label: 'Organic Perlin Clouds', value: 'clouds' },
          { label: 'Cyber Circuit Hex', value: 'hex' },
          { label: 'Weathered Stone', value: 'stone' },
          { label: 'Radial Gradient Mask', value: 'radial' },
          { label: 'Tangent Normal Map', value: 'normal' },
        ],
      },
    ],
  },
  {
    typeId: 'sample-texture2d',
    unityType: 'UnityEditor.ShaderGraph.SampleTexture2DNode',
    title: 'Sample Texture 2D',
    category: 'Input',
    subcategory: 'Texture',
    description: 'Samples a Texture 2D at the given UV coordinates and outputs RGBA and individual channels.',
    synonyms: ['tex2d', 'texture', 'sample'],
    hasPreview: true,
    inputs: [
      { id: 'texture', name: 'Texture', slotId: 1, direction: 'input', type: 'texture2d', defaultValue: 'uvgrid' },
      { id: 'uv', name: 'UV', slotId: 2, direction: 'input', type: '2', binding: 'uv0' },
    ],
    outputs: [
      { id: 'rgba', name: 'RGBA', slotId: 0, direction: 'output', type: '4' },
      { id: 'r', name: 'R', slotId: 4, direction: 'output', type: '1' },
      { id: 'g', name: 'G', slotId: 5, direction: 'output', type: '1' },
      { id: 'b', name: 'B', slotId: 6, direction: 'output', type: '1' },
      { id: 'a', name: 'A', slotId: 7, direction: 'output', type: '1' },
    ],
    settings: [
      {
        key: 'textureKey',
        label: 'Fallback Texture',
        type: 'texture',
        defaultValue: 'uvgrid',
      },
    ],
  },

  // ==========================================
  // MATH NODES
  // ==========================================
  {
    typeId: 'add',
    unityType: 'UnityEditor.ShaderGraph.AddNode',
    title: 'Add',
    category: 'Math',
    subcategory: 'Basic',
    description: 'Adds two Dynamic Vector values (A + B).',
    synonyms: ['plus', 'sum', '+'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'subtract',
    unityType: 'UnityEditor.ShaderGraph.SubtractNode',
    title: 'Subtract',
    category: 'Math',
    subcategory: 'Basic',
    description: 'Subtracts input B from input A (A - B).',
    synonyms: ['minus', 'difference', '-'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 1.0 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'multiply',
    unityType: 'UnityEditor.ShaderGraph.MultiplyNode',
    title: 'Multiply',
    category: 'Math',
    subcategory: 'Basic',
    description: 'Multiplies input A by input B component-wise (A * B).',
    synonyms: ['times', 'scale', 'product', '*'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 1.0 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 1.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'divide',
    unityType: 'UnityEditor.ShaderGraph.DivideNode',
    title: 'Divide',
    category: 'Math',
    subcategory: 'Basic',
    description: 'Divides input A by input B (A / B).',
    synonyms: ['ratio', 'quotient', '/'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 1.0 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 2.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'power',
    unityType: 'UnityEditor.ShaderGraph.PowerNode',
    title: 'Power',
    category: 'Math',
    subcategory: 'Basic',
    description: 'Raises Base (A) to the power of Exponent (B): pow(A, B).',
    synonyms: ['pow', 'exponent', '^'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 2.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'sqrt',
    unityType: 'UnityEditor.ShaderGraph.SquareRootNode',
    title: 'Square Root',
    category: 'Math',
    subcategory: 'Basic',
    description: 'Calculates the square root of input In.',
    synonyms: ['sqrt', 'root'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'abs',
    unityType: 'UnityEditor.ShaderGraph.AbsoluteNode',
    title: 'Absolute',
    category: 'Math',
    subcategory: 'Advanced',
    description: 'Returns the absolute (non-negative) value of input In.',
    synonyms: ['abs', 'magnitude'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: -0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'negate',
    unityType: 'UnityEditor.ShaderGraph.NegateNode',
    title: 'Negate',
    category: 'Math',
    subcategory: 'Advanced',
    description: 'Flips the sign of input In (-1 * In).',
    synonyms: ['invert', 'negative'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'one-minus',
    unityType: 'UnityEditor.ShaderGraph.OneMinusNode',
    title: 'One Minus',
    category: 'Math',
    subcategory: 'Range',
    description: 'Subtracts input In from 1.0 (1.0 - In).',
    synonyms: ['invert', 'complement', '1-x'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.25 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'saturate',
    unityType: 'UnityEditor.ShaderGraph.SaturateNode',
    title: 'Saturate',
    category: 'Math',
    subcategory: 'Range',
    description: 'Clamps input In between 0.0 and 1.0.',
    synonyms: ['clamp01'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'clamp',
    unityType: 'UnityEditor.ShaderGraph.ClampNode',
    title: 'Clamp',
    category: 'Math',
    subcategory: 'Range',
    description: 'Clamps input In between Min and Max.',
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
      { id: 'min', name: 'Min', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 0.0 },
      { id: 'max', name: 'Max', slotId: 2, direction: 'input', type: 'dynamic', defaultValue: 1.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'min',
    unityType: 'UnityEditor.ShaderGraph.MinimumNode',
    title: 'Minimum',
    category: 'Math',
    subcategory: 'Range',
    description: 'Returns the smaller of A and B component-wise.',
    synonyms: ['min'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.3 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 0.7 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'max',
    unityType: 'UnityEditor.ShaderGraph.MaximumNode',
    title: 'Maximum',
    category: 'Math',
    subcategory: 'Range',
    description: 'Returns the larger of A and B component-wise.',
    synonyms: ['max'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.3 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 0.7 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'lerp',
    unityType: 'UnityEditor.ShaderGraph.LerpNode',
    title: 'Lerp',
    category: 'Math',
    subcategory: 'Interpolation',
    description: 'Linearly interpolates between A and B by weight T.',
    synonyms: ['mix', 'blend', 'interpolate'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.0 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 1.0 },
      { id: 't', name: 'T', slotId: 2, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'inverse-lerp',
    unityType: 'UnityEditor.ShaderGraph.InverseLerpNode',
    title: 'Inverse Lerp',
    category: 'Math',
    subcategory: 'Interpolation',
    description: 'Calculates the normalized interpolation parameter (T - A) / (B - A).',
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.0 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 1.0 },
      { id: 't', name: 'T', slotId: 2, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'remap',
    unityType: 'UnityEditor.ShaderGraph.RemapNode',
    title: 'Remap',
    category: 'Math',
    subcategory: 'Range',
    description: 'Linearly maps input In from [In Min, In Max] to [Out Min, Out Max].',
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
      { id: 'inMinMax', name: 'In Min Max', slotId: 1, direction: 'input', type: '2', defaultValue: [-1, 1] },
      { id: 'outMinMax', name: 'Out Min Max', slotId: 2, direction: 'input', type: '2', defaultValue: [0, 1] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'fraction',
    unityType: 'UnityEditor.ShaderGraph.FractionNode',
    title: 'Fraction',
    category: 'Math',
    subcategory: 'Range',
    description: 'Returns the fractional part of input In (In - floor(In)).',
    synonyms: ['frac', 'fract', 'mod'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 1.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'floor',
    unityType: 'UnityEditor.ShaderGraph.FloorNode',
    title: 'Floor',
    category: 'Math',
    subcategory: 'Round',
    description: 'Rounds input In down to the nearest integer.',
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 1.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'ceil',
    unityType: 'UnityEditor.ShaderGraph.CeilingNode',
    title: 'Ceiling',
    category: 'Math',
    subcategory: 'Round',
    description: 'Rounds input In up to the nearest integer.',
    synonyms: ['ceil'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 1.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'round',
    unityType: 'UnityEditor.ShaderGraph.RoundNode',
    title: 'Round',
    category: 'Math',
    subcategory: 'Round',
    description: 'Rounds input In to the nearest integer.',
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 1.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'posterize',
    unityType: 'UnityEditor.ShaderGraph.PosterizeNode',
    title: 'Posterize',
    category: 'Math',
    subcategory: 'Advanced',
    description: 'Quantizes continuous values into a discrete number of Steps.',
    synonyms: ['quantize', 'toon', 'steps', 'bands'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
      { id: 'steps', name: 'Steps', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 4.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'step',
    unityType: 'UnityEditor.ShaderGraph.StepNode',
    title: 'Step',
    category: 'Math',
    subcategory: 'Interpolation',
    description: 'Returns 1.0 if In >= Edge, otherwise 0.0.',
     synonyms: ['threshold', 'cutoff'],
    hasPreview: true,
    inputs: [
      { id: 'edge', name: 'Edge', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
      { id: 'in', name: 'In', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'smoothstep',
    unityType: 'UnityEditor.ShaderGraph.SmoothstepNode',
    title: 'Smoothstep',
    category: 'Math',
    subcategory: 'Interpolation',
    description: 'Smooth Hermite interpolation between 0 and 1 when In is between Edge1 and Edge2.',
    hasPreview: true,
    inputs: [
      { id: 'edge1', name: 'Edge1', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.2 },
      { id: 'edge2', name: 'Edge2', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 0.8 },
      { id: 'in', name: 'In', slotId: 2, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'sine',
    unityType: 'UnityEditor.ShaderGraph.SineNode',
    title: 'Sine',
    category: 'Math',
    subcategory: 'Trigonometry',
    description: 'Returns the trigonometric sine of input In (in radians).',
    synonyms: ['sin', 'wave'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 1.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'cosine',
    unityType: 'UnityEditor.ShaderGraph.CosineNode',
    title: 'Cosine',
    category: 'Math',
    subcategory: 'Trigonometry',
    description: 'Returns the trigonometric cosine of input In (in radians).',
    synonyms: ['cos', 'wave'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'tangent',
    unityType: 'UnityEditor.ShaderGraph.TangentNode',
    title: 'Tangent',
    category: 'Math',
    subcategory: 'Trigonometry',
    description: 'Returns the trigonometric tangent of input In.',
    synonyms: ['tan'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'atan2',
    unityType: 'UnityEditor.ShaderGraph.Arctangent2Node',
    title: 'Arctangent2',
    category: 'Math',
    subcategory: 'Trigonometry',
    description: 'Returns the angle in radians whose tangent is A/B.',
    synonyms: ['atan2', 'angle'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'dot',
    unityType: 'UnityEditor.ShaderGraph.DotProductNode',
    title: 'Dot Product',
    category: 'Math',
    subcategory: 'Vector',
    description: 'Scalar dot product of two vectors A and B.',
    synonyms: ['dot', 'scalar product'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: [0, 1, 0] },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: [0, 1, 0] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'cross',
    unityType: 'UnityEditor.ShaderGraph.CrossProductNode',
    title: 'Cross Product',
    category: 'Math',
    subcategory: 'Vector',
    description: '3D cross product perpendicular to vectors A and B.',
    synonyms: ['cross'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: '3', defaultValue: [1, 0, 0] },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: '3', defaultValue: [0, 1, 0] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: '3' },
    ],
  },
  {
    typeId: 'normalize',
    unityType: 'UnityEditor.ShaderGraph.NormalizeNode',
    title: 'Normalize',
    category: 'Math',
    subcategory: 'Vector',
    description: 'Scales vector In to unit length (1.0).',
    synonyms: ['unit'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: [1, 1, 1] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'length',
    unityType: 'UnityEditor.ShaderGraph.LengthNode',
    title: 'Length',
    category: 'Math',
    subcategory: 'Vector',
    description: 'Calculates Euclidean magnitude of vector In.',
    synonyms: ['magnitude', 'norm'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: [0.5, 0.5] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'distance',
    unityType: 'UnityEditor.ShaderGraph.DistanceNode',
    title: 'Distance',
    category: 'Math',
    subcategory: 'Vector',
    description: 'Calculates Euclidean distance between points A and B.',
    synonyms: ['dist'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: [0, 0] },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: [0.5, 0.5] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: '1' },
    ],
  },

  // ==========================================
  // PROCEDURAL NODES
  // ==========================================
  {
    typeId: 'simple-noise',
    unityType: 'UnityEditor.ShaderGraph.SimpleNoiseNode',
    title: 'Simple Noise',
    category: 'Procedural',
    subcategory: 'Noise',
    description: 'Multi-octave fractal value noise matching Unity Shader Graph SimpleNoise.',
    synonyms: ['noise', 'fractal', 'fbm', 'clouds'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'scale', name: 'Scale', slotId: 1, direction: 'input', type: '1', defaultValue: 25.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'gradient-noise',
    unityType: 'UnityEditor.ShaderGraph.GradientNoiseNode',
    title: 'Gradient Noise',
    category: 'Procedural',
    subcategory: 'Noise',
    description: 'Smooth Perlin gradient noise matching Unity Shader Graph GradientNoise.',
    synonyms: ['perlin', 'noise'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'scale', name: 'Scale', slotId: 1, direction: 'input', type: '1', defaultValue: 10.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'voronoi',
    unityType: 'UnityEditor.ShaderGraph.VoronoiNode',
    title: 'Voronoi',
    category: 'Procedural',
    subcategory: 'Noise',
    description: 'Cellular Worley/Voronoi noise with animated Angle Offset and Cell Density.',
    synonyms: ['cellular', 'worley', 'cells', 'water', 'caustics'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'angleOffset', name: 'Angle Offset', slotId: 1, direction: 'input', type: '1', defaultValue: 2.0 },
      { id: 'cellDensity', name: 'Cell Density', slotId: 2, direction: 'input', type: '1', defaultValue: 5.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: '1' },
      { id: 'cells', name: 'Cells', slotId: 4, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'checkerboard',
    unityType: 'UnityEditor.ShaderGraph.CheckerboardNode',
    title: 'Checkerboard',
    category: 'Procedural',
    subcategory: 'Pattern',
    description: 'Generates an alternating checkerboard grid of Color A and Color B.',
    synonyms: ['grid', 'checker', 'tiles'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'colorA', name: 'Color A', slotId: 1, direction: 'input', type: '3', defaultValue: [0.15, 0.15, 0.18] },
      { id: 'colorB', name: 'Color B', slotId: 2, direction: 'input', type: '3', defaultValue: [0.85, 0.85, 0.9] },
      { id: 'frequency', name: 'Frequency', slotId: 3, direction: 'input', type: '2', defaultValue: [4, 4] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 4, direction: 'output', type: '3' },
    ],
  },
  {
    typeId: 'fresnel',
    unityType: 'UnityEditor.ShaderGraph.FresnelNode',
    title: 'Fresnel Effect',
    category: 'Procedural',
    subcategory: 'Lighting',
    description: 'Rim lighting falloff based on the grazing angle between Normal and View Direction: pow(1 - saturate(dot(N, V)), Power).',
    synonyms: ['rim', 'glow', 'edge', 'hologram'],
    hasPreview: true,
    inputs: [
      { id: 'normal', name: 'Normal', slotId: 0, direction: 'input', type: '3', binding: 'normalWS' },
      { id: 'viewDir', name: 'View Dir', slotId: 1, direction: 'input', type: '3', binding: 'viewDirWS' },
      { id: 'power', name: 'Power', slotId: 2, direction: 'input', type: '1', defaultValue: 3.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'ellipse',
    unityType: 'UnityEditor.ShaderGraph.EllipseNode',
    title: 'Ellipse',
    category: 'Procedural',
    subcategory: 'Shapes',
    description: 'Generates a smooth anti-aliased ellipse / circle shape centered at (0.5, 0.5).',
    synonyms: ['circle', 'dot', 'disc'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'width', name: 'Width', slotId: 1, direction: 'input', type: '1', defaultValue: 0.6 },
      { id: 'height', name: 'Height', slotId: 2, direction: 'input', type: '1', defaultValue: 0.6 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'rounded-rectangle',
    unityType: 'UnityEditor.ShaderGraph.RoundedRectangleNode',
    title: 'Rounded Rectangle',
    category: 'Procedural',
    subcategory: 'Shapes',
    description: 'Generates a rounded rectangle shape in UV space.',
    synonyms: ['box', 'rect', 'square'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'width', name: 'Width', slotId: 1, direction: 'input', type: '1', defaultValue: 0.7 },
      { id: 'height', name: 'Height', slotId: 2, direction: 'input', type: '1', defaultValue: 0.7 },
      { id: 'radius', name: 'Radius', slotId: 3, direction: 'input', type: '1', defaultValue: 0.15 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 4, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'polygon',
    unityType: 'UnityEditor.ShaderGraph.PolygonNode',
    title: 'Polygon',
    category: 'Procedural',
    subcategory: 'Shapes',
    description: 'Generates a regular N-sided polygon shape in UV space.',
    synonyms: ['hexagon', 'triangle', 'octagon', 'shape'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'sides', name: 'Sides', slotId: 1, direction: 'input', type: '1', defaultValue: 6.0 },
      { id: 'width', name: 'Width', slotId: 2, direction: 'input', type: '1', defaultValue: 0.6 },
      { id: 'height', name: 'Height', slotId: 3, direction: 'input', type: '1', defaultValue: 0.6 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 4, direction: 'output', type: '1' },
    ],
  },

  // ==========================================
  // UV NODES
  // ==========================================
  {
    typeId: 'tiling-and-offset',
    unityType: 'UnityEditor.ShaderGraph.TilingAndOffsetNode',
    title: 'Tiling And Offset',
    category: 'UV',
    description: 'Scales (tiles) and translates (offsets) UV coordinates: UV * Tiling + Offset.',
    synonyms: ['pan', 'scroll', 'scale uv', 'repeat'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'tiling', name: 'Tiling', slotId: 1, direction: 'input', type: '2', defaultValue: [1, 1] },
      { id: 'offset', name: 'Offset', slotId: 2, direction: 'input', type: '2', defaultValue: [0, 0] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: '2' },
    ],
  },
  {
    typeId: 'rotate',
    unityType: 'UnityEditor.ShaderGraph.RotateNode',
    title: 'Rotate',
    category: 'UV',
    description: 'Rotates UV coordinates around Center by Rotation (in radians).',
    synonyms: ['spin', 'turn'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'center', name: 'Center', slotId: 1, direction: 'input', type: '2', defaultValue: [0.5, 0.5] },
      { id: 'rotation', name: 'Rotation', slotId: 2, direction: 'input', type: '1', defaultValue: 0.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: '2' },
    ],
  },
  {
    typeId: 'polar-coordinates',
    unityType: 'UnityEditor.ShaderGraph.PolarCoordinatesNode',
    title: 'Polar Coordinates',
    category: 'UV',
    description: 'Converts Cartesian UV coordinates into radial (distance, angle) polar coordinates.',
    synonyms: ['radial', 'tunnel', 'circle uv'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'center', name: 'Center', slotId: 1, direction: 'input', type: '2', defaultValue: [0.5, 0.5] },
      { id: 'radialScale', name: 'Radial Scale', slotId: 2, direction: 'input', type: '1', defaultValue: 1.0 },
      { id: 'lengthScale', name: 'Length Scale', slotId: 3, direction: 'input', type: '1', defaultValue: 1.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 4, direction: 'output', type: '2' },
    ],
  },
  {
    typeId: 'twirl',
    unityType: 'UnityEditor.ShaderGraph.TwirlNode',
    title: 'Twirl',
    category: 'UV',
    description: 'Applies a vortex / swirl distortion effect to UV coordinates.',
    synonyms: ['swirl', 'spiral', 'vortex'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'center', name: 'Center', slotId: 1, direction: 'input', type: '2', defaultValue: [0.5, 0.5] },
      { id: 'strength', name: 'Strength', slotId: 2, direction: 'input', type: '1', defaultValue: 6.0 },
      { id: 'offset', name: 'Offset', slotId: 3, direction: 'input', type: '2', defaultValue: [0, 0] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 4, direction: 'output', type: '2' },
    ],
  },
  {
    typeId: 'radial-shear',
    unityType: 'UnityEditor.ShaderGraph.RadialShearNode',
    title: 'Radial Shear',
    category: 'UV',
    description: 'Applies a radial wave shear distortion around Center.',
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'center', name: 'Center', slotId: 1, direction: 'input', type: '2', defaultValue: [0.5, 0.5] },
      { id: 'strength', name: 'Strength', slotId: 2, direction: 'input', type: '2', defaultValue: [5, 5] },
      { id: 'offset', name: 'Offset', slotId: 3, direction: 'input', type: '2', defaultValue: [0, 0] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 4, direction: 'output', type: '2' },
    ],
  },
  {
    typeId: 'spherize',
    unityType: 'UnityEditor.ShaderGraph.SpherizeNode',
    title: 'Spherize',
    category: 'UV',
    description: 'Applies a spherical fisheye pinch/bulge distortion to UV coordinates.',
    synonyms: ['fisheye', 'lens', 'bulge'],
    hasPreview: true,
    inputs: [
      { id: 'uv', name: 'UV', slotId: 0, direction: 'input', type: '2', binding: 'uv0' },
      { id: 'center', name: 'Center', slotId: 1, direction: 'input', type: '2', defaultValue: [0.5, 0.5] },
      { id: 'strength', name: 'Strength', slotId: 2, direction: 'input', type: '2', defaultValue: [5, 5] },
      { id: 'offset', name: 'Offset', slotId: 3, direction: 'input', type: '2', defaultValue: [0, 0] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 4, direction: 'output', type: '2' },
    ],
  },

  // ==========================================
  // CHANNEL NODES
  // ==========================================
  {
    typeId: 'split',
    unityType: 'UnityEditor.ShaderGraph.SplitNode',
    title: 'Split',
    category: 'Channel',
    description: 'Splits a vector or color into individual scalar channels R, G, B, A.',
    synonyms: ['break', 'decompose', 'rgba', 'xyz'],
    hasPreview: false,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: [1, 0.5, 0.2, 1] },
    ],
    outputs: [
      { id: 'r', name: 'R', slotId: 1, direction: 'output', type: '1' },
      { id: 'g', name: 'G', slotId: 2, direction: 'output', type: '1' },
      { id: 'b', name: 'B', slotId: 3, direction: 'output', type: '1' },
      { id: 'a', name: 'A', slotId: 4, direction: 'output', type: '1' },
    ],
  },
  {
    typeId: 'combine',
    unityType: 'UnityEditor.ShaderGraph.CombineNode',
    title: 'Combine',
    category: 'Channel',
    description: 'Combines four scalar channels R, G, B, A into Vector4 (RGBA), Vector3 (RGB), and Vector2 (RG).',
    synonyms: ['append', 'make vector', 'join'],
    hasPreview: true,
    inputs: [
      { id: 'r', name: 'R', slotId: 0, direction: 'input', type: '1', defaultValue: 0.0 },
      { id: 'g', name: 'G', slotId: 1, direction: 'input', type: '1', defaultValue: 0.5 },
      { id: 'b', name: 'B', slotId: 2, direction: 'input', type: '1', defaultValue: 1.0 },
      { id: 'a', name: 'A', slotId: 3, direction: 'input', type: '1', defaultValue: 1.0 },
    ],
    outputs: [
      { id: 'rgba', name: 'RGBA', slotId: 4, direction: 'output', type: '4' },
      { id: 'rgb', name: 'RGB', slotId: 5, direction: 'output', type: '3' },
      { id: 'rg', name: 'RG', slotId: 6, direction: 'output', type: '2' },
    ],
  },
  {
    typeId: 'swizzle',
    unityType: 'UnityEditor.ShaderGraph.SwizzleNode',
    title: 'Swizzle',
    category: 'Channel',
    description: 'Rearranges or duplicates vector components using a mask (e.g. xy, zyx, xxx).',
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: '4', defaultValue: [1, 0.5, 0.2, 1] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: '4' },
    ],
    settings: [
      { key: 'mask', label: 'Mask (xyzw)', type: 'swizzle', defaultValue: 'zyxw' },
    ],
  },

  // ==========================================
  // ARTISTIC NODES
  // ==========================================
  {
    typeId: 'blend',
    unityType: 'UnityEditor.ShaderGraph.BlendNode',
    title: 'Blend',
    category: 'Artistic',
    subcategory: 'Blend',
    description: 'Blends Base and Blend layers using Photoshop-style blend modes and Opacity.',
    synonyms: ['overlay', 'screen', 'darken', 'lighten', 'dodge'],
    hasPreview: true,
    inputs: [
      { id: 'base', name: 'Base', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: [0.2, 0.4, 0.8] },
      { id: 'blend', name: 'Blend', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: [0.9, 0.3, 0.1] },
      { id: 'opacity', name: 'Opacity', slotId: 2, direction: 'input', type: '1', defaultValue: 1.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: 'dynamic' },
    ],
    settings: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        defaultValue: 'Overlay',
        options: [
          { label: 'Overlay', value: 'Overlay' },
          { label: 'Screen', value: 'Screen' },
          { label: 'Multiply', value: 'Multiply' },
          { label: 'Darken', value: 'Darken' },
          { label: 'Lighten', value: 'Lighten' },
          { label: 'Linear Dodge (Add)', value: 'LinearDodge' },
          { label: 'Difference', value: 'Difference' },
          { label: 'Soft Light', value: 'SoftLight' },
        ],
      },
    ],
  },
  {
    typeId: 'hue',
    unityType: 'UnityEditor.ShaderGraph.HueNode',
    title: 'Hue',
    category: 'Artistic',
    subcategory: 'Adjustment',
    description: 'Shifts the hue of color In by Offset (in normalized 0..1 turns).',
    synonyms: ['hsv', 'color shift'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: '3', defaultValue: [1, 0.2, 0.4] },
      { id: 'offset', name: 'Offset', slotId: 1, direction: 'input', type: '1', defaultValue: 0.25 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: '3' },
    ],
  },
  {
    typeId: 'saturation',
    unityType: 'UnityEditor.ShaderGraph.SaturationNode',
    title: 'Saturation',
    category: 'Artistic',
    subcategory: 'Adjustment',
    description: 'Adjusts color saturation of input In (0 = grayscale, 1 = original, >1 = vibrant).',
    synonyms: ['desaturate', 'grayscale'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: '3', defaultValue: [0.2, 0.7, 1.0] },
      { id: 'saturation', name: 'Saturation', slotId: 1, direction: 'input', type: '1', defaultValue: 1.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: '3' },
    ],
  },
  {
    typeId: 'contrast',
    unityType: 'UnityEditor.ShaderGraph.ContrastNode',
    title: 'Contrast',
    category: 'Artistic',
    subcategory: 'Adjustment',
    description: 'Adjusts contrast of input In around midpoint 0.5.',
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: '3', defaultValue: [0.3, 0.6, 0.9] },
      { id: 'contrast', name: 'Contrast', slotId: 1, direction: 'input', type: '1', defaultValue: 1.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: '3' },
    ],
  },
  {
    typeId: 'invert-colors',
    unityType: 'UnityEditor.ShaderGraph.InvertColorsNode',
    title: 'Invert Colors',
    category: 'Artistic',
    subcategory: 'Adjustment',
    description: 'Inverts RGB channels (1.0 - In).',
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: [0.2, 0.5, 0.8] },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'replace-color',
    unityType: 'UnityEditor.ShaderGraph.ReplaceColorNode',
    title: 'Replace Color',
    category: 'Artistic',
    subcategory: 'Adjustment',
    description: 'Replaces color From with color To within Range and Fuzziness.',
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: '3', defaultValue: [0.2, 0.6, 1.0] },
      { id: 'from', name: 'From', slotId: 1, direction: 'input', type: '3', defaultValue: [0.2, 0.6, 1.0] },
      { id: 'to', name: 'To', slotId: 2, direction: 'input', type: '3', defaultValue: [1.0, 0.3, 0.2] },
      { id: 'range', name: 'Range', slotId: 3, direction: 'input', type: '1', defaultValue: 0.3 },
      { id: 'fuzziness', name: 'Fuzziness', slotId: 4, direction: 'input', type: '1', defaultValue: 0.2 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 5, direction: 'output', type: '3' },
    ],
  },
  {
    typeId: 'color-ramp',
    unityType: 'UnityEditor.ShaderGraph.SampleGradientV1Node',
    title: 'Sample Gradient',
    category: 'Artistic',
    subcategory: 'Gradient',
    description: 'Maps a scalar Time (0..1) through a 3-stop Color Gradient.',
    synonyms: ['gradient', 'ramp', 'palette'],
    hasPreview: true,
    inputs: [
      { id: 'time', name: 'Time', slotId: 1, direction: 'input', type: '1', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '4' },
    ],
    settings: [
      { key: 'color0', label: 'Stop 0 (0%)', type: 'color', defaultValue: '#0a192f' },
      { key: 'color1', label: 'Stop 1 (50%)', type: 'color', defaultValue: '#00b4d8' },
      { key: 'color2', label: 'Stop 2 (100%)', type: 'color', defaultValue: '#ffbe0b' },
    ],
  },

  // ==========================================
  // UTILITY NODES
  // ==========================================
  {
    typeId: 'preview',
    unityType: 'UnityEditor.ShaderGraph.PreviewNode',
    title: 'Preview',
    category: 'Utility',
    description: 'Passes input straight through while displaying an intermediate 2D shader preview.',
    synonyms: ['debug', 'watch', 'inspect'],
    hasPreview: true,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'comparison',
    unityType: 'UnityEditor.ShaderGraph.ComparisonNode',
    title: 'Comparison',
    category: 'Utility',
    subcategory: 'Logic',
    description: 'Compares scalar A and B and outputs a Boolean.',
    synonyms: ['equal', 'greater', 'less', 'if'],
    hasPreview: false,
    inputs: [
      { id: 'a', name: 'A', slotId: 0, direction: 'input', type: '1', defaultValue: 0.5 },
      { id: 'b', name: 'B', slotId: 1, direction: 'input', type: '1', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 2, direction: 'output', type: 'boolean' },
    ],
    settings: [
      {
        key: 'comparison',
        label: 'Comparison',
        type: 'select',
        defaultValue: 'Greater',
        options: [
          { label: 'Equal (==)', value: 'Equal' },
          { label: 'Not Equal (!=)', value: 'NotEqual' },
          { label: 'Less (<)', value: 'Less' },
          { label: 'Less Or Equal (<=)', value: 'LessOrEqual' },
          { label: 'Greater (>)', value: 'Greater' },
          { label: 'Greater Or Equal (>=)', value: 'GreaterOrEqual' },
        ],
      },
    ],
  },
  {
    typeId: 'branch',
    unityType: 'UnityEditor.ShaderGraph.BranchNode',
    title: 'Branch',
    category: 'Utility',
    subcategory: 'Logic',
    description: 'Outputs True if Predicate is true, otherwise False.',
    synonyms: ['if', 'select', 'ternary', 'switch'],
    hasPreview: true,
    inputs: [
      { id: 'predicate', name: 'Predicate', slotId: 0, direction: 'input', type: 'boolean', defaultValue: true },
      { id: 'true', name: 'True', slotId: 1, direction: 'input', type: 'dynamic', defaultValue: 1.0 },
      { id: 'false', name: 'False', slotId: 2, direction: 'input', type: 'dynamic', defaultValue: 0.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 3, direction: 'output', type: 'dynamic' },
    ],
  },
  {
    typeId: 'custom-function',
    unityType: 'UnityEditor.ShaderGraph.CustomFunctionNode',
    title: 'Custom Function',
    category: 'Utility',
    description: 'Evaluates a custom inline shader expression using inputs A (vec3) and B (float).',
    synonyms: ['hlsl', 'glsl', 'code', 'script', 'expression'],
    hasPreview: true,
    inputs: [
      { id: 'a', name: 'A (3)', slotId: 0, direction: 'input', type: '3', defaultValue: [1, 0.5, 0.2] },
      { id: 'b', name: 'B (1)', slotId: 1, direction: 'input', type: '1', defaultValue: 2.0 },
    ],
    outputs: [
      { id: 'out', name: 'Out (3)', slotId: 2, direction: 'output', type: '3' },
    ],
    settings: [
      {
        key: 'functionName',
        label: 'Function Name',
        type: 'text',
        defaultValue: 'MyCustomExpression',
      },
      {
        key: 'expression',
        label: 'Expression (uses A, B)',
        type: 'textarea',
        defaultValue: 'sin(A * B * 3.14159) * 0.5 + 0.5',
      },
    ],
  },

  // ==========================================
  // PROPERTY & PASSTHROUGH NODES
  // ==========================================
  {
    typeId: 'property',
    unityType: 'UnityEditor.ShaderGraph.PropertyNode',
    title: 'Property',
    category: 'Input',
    subcategory: 'Blackboard',
    description: 'References an exposed property from the Blackboard.',
    hasPreview: false,
    inputs: [],
    outputs: [
      { id: 'out', name: 'Out', slotId: 0, direction: 'output', type: '4' },
    ],
  },
  {
    typeId: 'unknown-unity',
    unityType: 'UnityEditor.ShaderGraph.UnknownNode',
    title: 'Imported Unity Node',
    category: 'Utility',
    description: 'Placeholder for an unrecognized node imported from a Unity .shadergraph file. Preserves original Unity metadata on re-export.',
    hasPreview: false,
    inputs: [
      { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
    ],
    outputs: [
      { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
    ],
  },
];

export const NODE_DEFINITION_MAP = new Map<string, NodeDefinition>(
  NODE_DEFINITIONS.map((def) => [def.typeId, def])
);

export const UNITY_TYPE_TO_NODE_DEF = new Map<string, NodeDefinition>(
  NODE_DEFINITIONS.filter((d) => !d.isMaster && d.typeId !== 'unknown-unity').map((def) => [def.unityType, def])
);

export function getNodeDefinition(
  node: GraphNode,
  properties: BlackboardProperty[]
): NodeDefinition {
  if (node.typeId === 'property' && node.propertyId) {
    const prop = properties.find((p) => p.id === node.propertyId);
    if (prop) {
      const portTypeMap: Record<string, PortDefinition['type']> = {
        float: '1',
        vector2: '2',
        vector3: '3',
        vector4: '4',
        color: 'color',
        texture2d: 'texture2d',
        boolean: 'boolean',
      };
      return {
        typeId: 'property',
        unityType: 'UnityEditor.ShaderGraph.PropertyNode',
        title: prop.name,
        category: 'Input',
        subcategory: 'Blackboard',
        description: `Blackboard Property (${prop.referenceName})`,
        hasPreview: false,
        inputs: [],
        outputs: [
          {
            id: 'out',
            name: `${prop.name}`,
            slotId: 0,
            direction: 'output',
            type: portTypeMap[prop.type] || '1',
          },
        ],
      };
    }
  }

  if (node.typeId === 'unknown-unity' && node.unknownUnityData) {
    return {
      typeId: 'unknown-unity',
      unityType: node.unknownUnityData.unityType,
      title: node.unknownUnityData.title || 'Unity Node',
      category: 'Utility',
      description: `Imported Unity node (${node.unknownUnityData.unityType}) preserved for round-trip export.`,
      hasPreview: false,
      inputs: [
        { id: 'in', name: 'In', slotId: 0, direction: 'input', type: 'dynamic', defaultValue: 0.5 },
      ],
      outputs: [
        { id: 'out', name: 'Out', slotId: 1, direction: 'output', type: 'dynamic' },
      ],
    };
  }

  return (
    NODE_DEFINITION_MAP.get(node.typeId) || {
      typeId: node.typeId,
      unityType: 'UnityEditor.ShaderGraph.UnknownNode',
      title: node.typeId,
      category: 'Utility',
      description: 'Unknown node',
      inputs: [],
      outputs: [],
    }
  );
}
