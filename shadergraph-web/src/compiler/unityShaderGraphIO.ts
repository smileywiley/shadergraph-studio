import {
  ShaderGraphProject,
  GraphNode,
  GraphEdge,
  BlackboardProperty,
  GraphGroup,
  StickyNote,
  PortDefinition,
} from '../types/shadergraph';
import {
  getNodeDefinition,
  UNITY_TYPE_TO_NODE_DEF,
  NODE_DEFINITION_MAP,
} from '../nodes/nodeRegistry';
import { hexToRgbNormalized } from './shaderCompiler';

function deterministicGuid(seed: string): string {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  let h3 = 0x1b873593 ^ seed.length;
  let h4 = 0x85ebca6b ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (
    '#' +
    [clamp255(r), clamp255(g), clamp255(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

const MASTER_BLOCK_MAP: {
  portId: string;
  descriptor: string;
  stage: 'vertex' | 'fragment';
  slotType: string;
  slotName: string;
}[] = [
  {
    portId: 'vertexPosition',
    descriptor: 'VertexDescription.Position',
    stage: 'vertex',
    slotType: 'UnityEditor.ShaderGraph.PositionMaterialSlot',
    slotName: 'Position',
  },
  {
    portId: 'vertexNormal',
    descriptor: 'VertexDescription.Normal',
    stage: 'vertex',
    slotType: 'UnityEditor.ShaderGraph.NormalMaterialSlot',
    slotName: 'Normal',
  },
  {
    portId: 'vertexTangent',
    descriptor: 'VertexDescription.Tangent',
    stage: 'vertex',
    slotType: 'UnityEditor.ShaderGraph.TangentMaterialSlot',
    slotName: 'Tangent',
  },
  {
    portId: 'baseColor',
    descriptor: 'SurfaceDescription.BaseColor',
    stage: 'fragment',
    slotType: 'UnityEditor.ShaderGraph.ColorRGBMaterialSlot',
    slotName: 'BaseColor',
  },
  {
    portId: 'normal',
    descriptor: 'SurfaceDescription.NormalTS',
    stage: 'fragment',
    slotType: 'UnityEditor.ShaderGraph.NormalMaterialSlot',
    slotName: 'NormalTS',
  },
  {
    portId: 'metallic',
    descriptor: 'SurfaceDescription.Metallic',
    stage: 'fragment',
    slotType: 'UnityEditor.ShaderGraph.Vector1MaterialSlot',
    slotName: 'Metallic',
  },
  {
    portId: 'smoothness',
    descriptor: 'SurfaceDescription.Smoothness',
    stage: 'fragment',
    slotType: 'UnityEditor.ShaderGraph.Vector1MaterialSlot',
    slotName: 'Smoothness',
  },
  {
    portId: 'emission',
    descriptor: 'SurfaceDescription.Emission',
    stage: 'fragment',
    slotType: 'UnityEditor.ShaderGraph.ColorRGBMaterialSlot',
    slotName: 'Emission',
  },
  {
    portId: 'occlusion',
    descriptor: 'SurfaceDescription.Occlusion',
    stage: 'fragment',
    slotType: 'UnityEditor.ShaderGraph.Vector1MaterialSlot',
    slotName: 'Occlusion',
  },
  {
    portId: 'alpha',
    descriptor: 'SurfaceDescription.Alpha',
    stage: 'fragment',
    slotType: 'UnityEditor.ShaderGraph.Vector1MaterialSlot',
    slotName: 'Alpha',
  },
  {
    portId: 'alphaClipThreshold',
    descriptor: 'SurfaceDescription.AlphaClipThreshold',
    stage: 'fragment',
    slotType: 'UnityEditor.ShaderGraph.Vector1MaterialSlot',
    slotName: 'AlphaClipThreshold',
  },
];

function getUnitySlotType(port: PortDefinition): string {
  switch (port.type) {
    case '1':
      return 'UnityEditor.ShaderGraph.Vector1MaterialSlot';
    case '2':
      return port.binding === 'uv0'
        ? 'UnityEditor.ShaderGraph.UVMaterialSlot'
        : 'UnityEditor.ShaderGraph.Vector2MaterialSlot';
    case '3':
      return 'UnityEditor.ShaderGraph.Vector3MaterialSlot';
    case '4':
      return 'UnityEditor.ShaderGraph.Vector4MaterialSlot';
    case 'color':
      return 'UnityEditor.ShaderGraph.ColorRGBAMaterialSlot';
    case 'texture2d':
      return port.direction === 'input'
        ? 'UnityEditor.ShaderGraph.Texture2DInputMaterialSlot'
        : 'UnityEditor.ShaderGraph.Texture2DMaterialSlot';
    case 'boolean':
      return 'UnityEditor.ShaderGraph.BooleanMaterialSlot';
    case 'dynamic':
    default:
      return 'UnityEditor.ShaderGraph.DynamicVectorMaterialSlot';
  }
}

/**
 * Serializes a ShaderGraphProject into Unity's native multi-JSON `.shadergraph` format (m_SGVersion: 3).
 */
export function exportToUnityShaderGraph(project: ShaderGraphProject): string {
  const chunks: Record<string, any>[] = [];

  const graphObjectId = deterministicGuid(`graph_${project.id}`);
  const categoryObjectId = deterministicGuid(`cat_${project.id}`);
  const targetObjectId = deterministicGuid(`target_${project.id}`);
  const subTargetObjectId = deterministicGuid(`subtarget_${project.id}`);

  const propertyRefs: { m_Id: string }[] = [];
  const propertyGuidMap = new Map<string, string>();

  // 1. Serialize Blackboard Properties
  for (const prop of project.properties) {
    const propGuid = deterministicGuid(`prop_${prop.id}`);
    propertyGuidMap.set(prop.id, propGuid);
    propertyRefs.push({ m_Id: propGuid });

    let unityPropType = 'UnityEditor.ShaderGraph.Internal.Vector1ShaderProperty';
    let propVal: any = typeof prop.value === 'number' ? prop.value : 0;

    if (prop.type === 'color') {
      unityPropType = 'UnityEditor.ShaderGraph.Internal.ColorShaderProperty';
      const [r, g, b, a] = hexToRgbNormalized(prop.value || '#ffffff');
      propVal = { r, g, b, a };
    } else if (prop.type === 'vector2') {
      unityPropType = 'UnityEditor.ShaderGraph.Internal.Vector2ShaderProperty';
      const v = Array.isArray(prop.value) ? prop.value : [0, 0];
      propVal = { x: v[0] || 0, y: v[1] || 0, z: 0, w: 0 };
    } else if (prop.type === 'vector3') {
      unityPropType = 'UnityEditor.ShaderGraph.Internal.Vector3ShaderProperty';
      const v = Array.isArray(prop.value) ? prop.value : [0, 0, 0];
      propVal = { x: v[0] || 0, y: v[1] || 0, z: v[2] || 0, w: 0 };
    } else if (prop.type === 'vector4') {
      unityPropType = 'UnityEditor.ShaderGraph.Internal.Vector4ShaderProperty';
      const v = Array.isArray(prop.value) ? prop.value : [0, 0, 0, 1];
      propVal = { x: v[0] || 0, y: v[1] || 0, z: v[2] || 0, w: v[3] ?? 1 };
    } else if (prop.type === 'boolean') {
      unityPropType = 'UnityEditor.ShaderGraph.Internal.BooleanShaderProperty';
      propVal = Boolean(prop.value);
    } else if (prop.type === 'texture2d') {
      unityPropType = 'UnityEditor.ShaderGraph.Internal.Texture2DShaderProperty';
      propVal = {
        m_SerializedTexture: '{"texture":{"fileID":0}}',
        m_Guid: '',
      };
    }

    chunks.push({
      m_SGVersion: 1,
      m_Type: unityPropType,
      m_ObjectId: propGuid,
      m_Guid: { m_GuidSerialized: propGuid },
      m_Name: prop.name,
      m_DefaultReferenceName: prop.referenceName,
      m_OverrideReferenceName: prop.referenceName,
      m_GeneratePropertyBlock: prop.exposed,
      m_UseCustomSlotLabel: false,
      m_CustomSlotLabel: '',
      m_Precision: 0,
      isMainTexture: false,
      isMainColor: false,
      m_Value: propVal,
    });
  }

  // CategoryData
  chunks.push({
    m_SGVersion: 0,
    m_Type: 'UnityEditor.ShaderGraph.CategoryData',
    m_ObjectId: categoryObjectId,
    m_Name: '',
    m_ChildObjectList: propertyRefs,
  });

  // 2. Serialize Master Stack BlockNodes
  const masterNode =
    project.nodes.find((n) => n.typeId === 'master-lit') ||
    ({
      id: 'master',
      typeId: 'master-lit',
      position: { x: 640, y: 120 },
      previewExpanded: false,
      inputValues: {},
      settings: {},
    } as GraphNode);

  const vertexBlockRefs: { m_Id: string }[] = [];
  const fragmentBlockRefs: { m_Id: string }[] = [];
  const masterBlockGuidByPort = new Map<string, string>();

  const activeBlocks =
    project.settings.subTarget === 'Unlit'
      ? MASTER_BLOCK_MAP.filter((b) =>
          [
            'vertexPosition',
            'vertexNormal',
            'vertexTangent',
            'baseColor',
            'alpha',
            'alphaClipThreshold',
          ].includes(b.portId)
        )
      : MASTER_BLOCK_MAP;

  for (const blk of activeBlocks) {
    const blockGuid = deterministicGuid(`block_${project.id}_${blk.portId}`);
    const slotGuid = deterministicGuid(`blockslot_${project.id}_${blk.portId}`);
    masterBlockGuidByPort.set(blk.portId, blockGuid);

    if (blk.stage === 'vertex') {
      vertexBlockRefs.push({ m_Id: blockGuid });
    } else {
      fragmentBlockRefs.push({ m_Id: blockGuid });
    }

    chunks.push({
      m_SGVersion: 0,
      m_Type: 'UnityEditor.ShaderGraph.BlockNode',
      m_ObjectId: blockGuid,
      m_Group: { m_Id: '' },
      m_Name: blk.descriptor,
      m_DrawState: {
        m_Expanded: true,
        m_Position: {
          serializedVersion: '2',
          x: 0.0,
          y: 0.0,
          width: 0.0,
          height: 0.0,
        },
      },
      m_Slots: [{ m_Id: slotGuid }],
      synonyms: [],
      m_Precision: 0,
      m_PreviewExpanded: false,
      m_DismissedVersion: 0,
      m_PreviewMode: 0,
      m_CustomColors: { m_SerializableColors: [] },
      m_SerializedDescriptor: blk.descriptor,
    });

    const rawVal = masterNode.inputValues?.[blk.portId];
    let slotValue: any = 0.0;
    if (blk.slotType.includes('ColorRGB')) {
      const [r, g, b] = hexToRgbNormalized(typeof rawVal === 'string' ? rawVal : '#4ca6ff');
      slotValue = { x: r, y: g, z: b };
    } else if (
      blk.slotType.includes('Position') ||
      blk.slotType.includes('Normal') ||
      blk.slotType.includes('Tangent')
    ) {
      slotValue = { x: 0.0, y: 0.0, z: 0.0 };
    } else {
      slotValue = typeof rawVal === 'number' ? rawVal : 0.5;
    }

    chunks.push({
      m_SGVersion: 0,
      m_Type: blk.slotType,
      m_ObjectId: slotGuid,
      m_Id: 0,
      m_DisplayName: blk.slotName,
      m_SlotType: 0,
      m_Hidden: false,
      m_ShaderOutputName: blk.slotName,
      m_StageCapability: blk.stage === 'vertex' ? 1 : 2,
      m_Value: slotValue,
      m_DefaultValue: slotValue,
      m_Labels: [],
    });
  }

  // 3. Serialize Regular Graph Nodes & MaterialSlots
  const nodeRefs: { m_Id: string }[] = [...vertexBlockRefs, ...fragmentBlockRefs];
  const nodeGuidMap = new Map<string, string>();

  for (const node of project.nodes) {
    if (node.typeId === 'master-lit') continue;

    const nodeGuid = deterministicGuid(`node_${node.id}`);
    nodeGuidMap.set(node.id, nodeGuid);
    nodeRefs.push({ m_Id: nodeGuid });

    // If this was an unrecognized imported Unity node, preserve its raw JSON!
    if (node.typeId === 'unknown-unity' && node.unknownUnityData?.rawJson) {
      chunks.push({
        ...node.unknownUnityData.rawJson,
        m_ObjectId: nodeGuid,
        m_DrawState: {
          m_Expanded: true,
          m_Position: {
            serializedVersion: '2',
            x: node.position.x,
            y: node.position.y,
            width: 208.0,
            height: 278.0,
          },
        },
      });
      continue;
    }

    const def = getNodeDefinition(node, project.properties);
    const allPorts = [...def.inputs, ...def.outputs];
    const slotRefs: { m_Id: string }[] = [];

    for (const port of allPorts) {
      const slotGuid = deterministicGuid(`slot_${node.id}_${port.id}`);
      slotRefs.push({ m_Id: slotGuid });

      const rawVal = node.inputValues?.[port.id] ?? port.defaultValue;
      let mVal: any = { x: 0, y: 0, z: 0, w: 0 };
      if (typeof rawVal === 'number') {
        mVal = port.type === '1' ? rawVal : { x: rawVal, y: rawVal, z: rawVal, w: rawVal };
      } else if (Array.isArray(rawVal)) {
        mVal = {
          x: rawVal[0] ?? 0,
          y: rawVal[1] ?? 0,
          z: rawVal[2] ?? 0,
          w: rawVal[3] ?? 0,
        };
      }

      chunks.push({
        m_SGVersion: 0,
        m_Type: getUnitySlotType(port),
        m_ObjectId: slotGuid,
        m_Id: port.slotId,
        m_DisplayName: port.name,
        m_SlotType: port.direction === 'input' ? 0 : 1,
        m_Hidden: false,
        m_ShaderOutputName: port.name.replace(/\s+/g, ''),
        m_StageCapability: 3,
        m_Value: mVal,
        m_DefaultValue: mVal,
        m_Labels: [],
      });
    }

    const nodeChunk: Record<string, any> = {
      m_SGVersion: 0,
      m_Type: def.unityType,
      m_ObjectId: nodeGuid,
      m_Group: { m_Id: '' },
      m_Name: def.title,
      m_DrawState: {
        m_Expanded: true,
        m_Position: {
          serializedVersion: '2',
          x: node.position.x,
          y: node.position.y,
          width: 208.0,
          height: node.previewExpanded ? 302.0 : 140.0,
        },
      },
      m_Slots: slotRefs,
      synonyms: def.synonyms || [],
      m_Precision: 0,
      m_PreviewExpanded: node.previewExpanded,
      m_DismissedVersion: 0,
      m_PreviewMode: 0,
      m_CustomColors: { m_SerializableColors: [] },
      // Persist web settings so re-importing into ShaderGraph Web restores exact settings
      m_WebSettings: node.settings || {},
    };

    if (node.typeId === 'property' && node.propertyId) {
      nodeChunk.m_Property = {
        m_Id: propertyGuidMap.get(node.propertyId) || '',
      };
    }

    if (node.typeId === 'color') {
      const [r, g, b, a] = hexToRgbNormalized(node.settings?.color || '#00d2ff');
      nodeChunk.m_Color = {
        color: { r, g, b, a },
        mode: (node.settings?.intensity ?? 1) > 1 ? 1 : 0,
      };
    }

    chunks.push(nodeChunk);
  }

  // 4. Serialize Groups & Sticky Notes
  const groupRefs: { m_Id: string }[] = [];
  for (const grp of project.groups) {
    const gGuid = deterministicGuid(`group_${grp.id}`);
    groupRefs.push({ m_Id: gGuid });
    chunks.push({
      m_SGVersion: 0,
      m_Type: 'UnityEditor.ShaderGraph.GroupData',
      m_ObjectId: gGuid,
      m_Title: grp.title,
      m_Position: {
        serializedVersion: '2',
        x: grp.position.x,
        y: grp.position.y,
        width: grp.size.width,
        height: grp.size.height,
      },
    });
  }

  const noteRefs: { m_Id: string }[] = [];
  for (const note of project.stickyNotes) {
    const nGuid = deterministicGuid(`note_${note.id}`);
    noteRefs.push({ m_Id: nGuid });
    chunks.push({
      m_SGVersion: 0,
      m_Type: 'UnityEditor.ShaderGraph.StickyNoteData',
      m_ObjectId: nGuid,
      m_Title: note.title,
      m_Content: note.content,
      m_Theme: note.theme === 'amber' ? 1 : 0,
      m_TextSize: 1,
      m_Position: {
        serializedVersion: '2',
        x: note.position.x,
        y: note.position.y,
        width: note.size.width,
        height: note.size.height,
      },
      m_Group: { m_Id: '' },
    });
  }

  // 5. Serialize Edges
  const unityEdges: any[] = [];
  for (const edge of project.edges) {
    const srcNode = project.nodes.find((n) => n.id === edge.sourceNodeId);
    const tgtNode = project.nodes.find((n) => n.id === edge.targetNodeId);
    if (!srcNode || !tgtNode) continue;

    const srcDef = getNodeDefinition(srcNode, project.properties);
    const srcPort = srcDef.outputs.find((p) => p.id === edge.sourcePortId);
    const srcSlotId = srcPort ? srcPort.slotId : 0;
    const srcGuid = nodeGuidMap.get(srcNode.id);
    if (!srcGuid) continue;

    if (tgtNode.typeId === 'master-lit') {
      const blockGuid = masterBlockGuidByPort.get(edge.targetPortId);
      if (blockGuid) {
        unityEdges.push({
          m_OutputSlot: {
            m_Node: { m_Id: srcGuid },
            m_SlotId: srcSlotId,
          },
          m_InputSlot: {
            m_Node: { m_Id: blockGuid },
            m_SlotId: 0,
          },
        });
      }
    } else {
      const tgtDef = getNodeDefinition(tgtNode, project.properties);
      const tgtPort = tgtDef.inputs.find((p) => p.id === edge.targetPortId);
      const tgtSlotId = tgtPort ? tgtPort.slotId : 0;
      const tgtGuid = nodeGuidMap.get(tgtNode.id);
      if (tgtGuid) {
        unityEdges.push({
          m_OutputSlot: {
            m_Node: { m_Id: srcGuid },
            m_SlotId: srcSlotId,
          },
          m_InputSlot: {
            m_Node: { m_Id: tgtGuid },
            m_SlotId: tgtSlotId,
          },
        });
      }
    }
  }

  // 6. UniversalTarget & SubTarget
  chunks.push({
    m_SGVersion: 1,
    m_Type: 'UnityEditor.Rendering.Universal.ShaderGraph.UniversalTarget',
    m_ObjectId: targetObjectId,
    m_ActiveSubTarget: { m_Id: subTargetObjectId },
    m_AllowMaterialOverride: false,
    m_SurfaceType: project.settings.surfaceType === 'Transparent' ? 1 : 0,
    m_AlphaMode:
      project.settings.blendMode === 'Premultiply'
        ? 1
        : project.settings.blendMode === 'Additive'
        ? 2
        : project.settings.blendMode === 'Multiply'
        ? 3
        : 0,
    m_RenderFace:
      project.settings.renderFace === 'Front'
        ? 2
        : project.settings.renderFace === 'Back'
        ? 1
        : 0,
    m_AlphaClip: project.settings.alphaClip,
    m_CastShadows: project.settings.castShadows,
    m_ReceiveShadows: true,
  });

  chunks.push({
    m_SGVersion: 2,
    m_Type:
      project.settings.subTarget === 'Unlit'
        ? 'UnityEditor.Rendering.Universal.ShaderGraph.UniversalUnlitSubTarget'
        : 'UnityEditor.Rendering.Universal.ShaderGraph.UniversalLitSubTarget',
    m_ObjectId: subTargetObjectId,
    m_WorkflowMode: 1,
    m_NormalDropOffSpace: 0,
    m_ClearCoat: false,
  });

  // 7. Root GraphData Object (prepended at index 0)
  const rootGraphData = {
    m_SGVersion: 3,
    m_Type: 'UnityEditor.ShaderGraph.GraphData',
    m_ObjectId: graphObjectId,
    m_Properties: propertyRefs,
    m_Keywords: [],
    m_Dropdowns: [],
    m_CategoryData: [{ m_Id: categoryObjectId }],
    m_Nodes: nodeRefs,
    m_GroupDatas: groupRefs,
    m_StickyNoteDatas: noteRefs,
    m_Edges: unityEdges,
    m_VertexContext: {
      m_Position: {
        x: masterNode.position.x,
        y: masterNode.position.y,
      },
      m_Blocks: vertexBlockRefs,
    },
    m_FragmentContext: {
      m_Position: {
        x: masterNode.position.x,
        y: masterNode.position.y + 200,
      },
      m_Blocks: fragmentBlockRefs,
    },
    m_PreviewData: {
      serializedMesh: {
        m_SerializedMesh: '{"mesh":{"fileID":0}}',
        m_Guid: '',
      },
      preventRotation: false,
    },
    m_Path: 'Shader Graphs',
    m_GraphPrecision: 0,
    m_PreviewMode: 0,
    m_OutputNode: { m_Id: '' },
    m_ActiveTargets: [{ m_Id: targetObjectId }],
  };

  const allObjects = [rootGraphData, ...chunks];
  return allObjects.map((obj) => JSON.stringify(obj, null, 4)).join('\n\n') + '\n';
}

/**
 * Splits a multi-JSON Unity `.shadergraph` file into individual parsed JSON objects.
 */
function parseMultiJsonObjects(rawText: string): Record<string, any>[] {
  const objects: Record<string, any>[] = [];
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let startIdx = -1;

  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') {
        if (depth === 0) startIdx = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && startIdx !== -1) {
          const slice = rawText.slice(startIdx, i + 1);
          try {
            objects.push(JSON.parse(slice));
          } catch {
            // Ignore malformed fragment
          }
          startIdx = -1;
        }
      }
    }
  }
  return objects;
}

/**
 * Imports either a native Unity `.shadergraph` file or a ShaderGraphWeb JSON project file.
 */
export function importShaderGraphFile(
  rawText: string,
  fileName = 'ImportedShaderGraph'
): ShaderGraphProject {
  const cleanName = fileName.replace(/\.(shadergraph|json)$/i, '');

  // Check if it is our native project JSON first
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return {
        ...parsed,
        id: parsed.id || `proj_${Date.now()}`,
        name: parsed.name || cleanName,
        updatedAt: Date.now(),
      };
    }
  } catch {
    // Proceed to multi-JSON Unity .shadergraph parser
  }

  const objects = parseMultiJsonObjects(rawText);
  if (objects.length === 0) {
    throw new Error('No valid JSON objects found in .shadergraph file.');
  }

  const root =
    objects.find((o) => o.m_Type === 'UnityEditor.ShaderGraph.GraphData') || objects[0];
  const byObjectId = new Map<string, Record<string, any>>();
  for (const obj of objects) {
    if (obj.m_ObjectId) {
      byObjectId.set(obj.m_ObjectId, obj);
    }
  }

  // 1. Parse Blackboard Properties
  const properties: BlackboardProperty[] = [];
  const propGuidToId = new Map<string, string>();

  for (const propRef of root.m_Properties || []) {
    const pObj = byObjectId.get(propRef.m_Id);
    if (!pObj) continue;

    const pId = `prop_${pObj.m_ObjectId.slice(0, 8)}`;
    propGuidToId.set(pObj.m_ObjectId, pId);

    let type: BlackboardProperty['type'] = 'float';
    let value: any = 0.5;
    const mType = String(pObj.m_Type || '');

    if (mType.includes('ColorShaderProperty')) {
      type = 'color';
      const c = pObj.m_Value || { r: 1, g: 1, b: 1 };
      value = rgbToHex(c.r ?? 1, c.g ?? 1, c.b ?? 1);
    } else if (mType.includes('Vector2ShaderProperty')) {
      type = 'vector2';
      const v = pObj.m_Value || { x: 0, y: 0 };
      value = [v.x ?? 0, v.y ?? 0];
    } else if (mType.includes('Vector3ShaderProperty')) {
      type = 'vector3';
      const v = pObj.m_Value || { x: 0, y: 0, z: 0 };
      value = [v.x ?? 0, v.y ?? 0, v.z ?? 0];
    } else if (mType.includes('Vector4ShaderProperty')) {
      type = 'vector4';
      const v = pObj.m_Value || { x: 0, y: 0, z: 0, w: 1 };
      value = [v.x ?? 0, v.y ?? 0, v.z ?? 0, v.w ?? 1];
    } else if (mType.includes('BooleanShaderProperty')) {
      type = 'boolean';
      value = Boolean(pObj.m_Value);
    } else if (mType.includes('Texture2DShaderProperty')) {
      type = 'texture2d';
      value = 'uvgrid';
    } else {
      type = 'float';
      value = typeof pObj.m_Value === 'number' ? pObj.m_Value : pObj.m_Value?.x ?? 0.5;
    }

    properties.push({
      id: pId,
      name: pObj.m_Name || 'Property',
      referenceName:
        pObj.m_OverrideReferenceName || pObj.m_DefaultReferenceName || `_${pObj.m_Name || 'Prop'}`,
      type,
      value,
      exposed: pObj.m_GeneratePropertyBlock !== false,
    });
  }

  // 2. Parse Master Stack & BlockNodes
  const masterPos = root.m_VertexContext?.m_Position || { x: 650, y: 120 };
  const masterNode: GraphNode = {
    id: 'master-node',
    typeId: 'master-lit',
    position: { x: masterPos.x ?? 650, y: masterPos.y ?? 120 },
    previewExpanded: false,
    inputValues: {},
    settings: {},
  };

  const blockGuidToMasterPort = new Map<string, string>();
  const nodes: GraphNode[] = [masterNode];
  const unityNodeGuidToGraphNode = new Map<string, GraphNode>();

  for (const nRef of root.m_Nodes || []) {
    const nObj = byObjectId.get(nRef.m_Id);
    if (!nObj) continue;

    if (nObj.m_Type === 'UnityEditor.ShaderGraph.BlockNode') {
      const desc = String(nObj.m_SerializedDescriptor || nObj.m_Name || '');
      const matched = MASTER_BLOCK_MAP.find((b) => b.descriptor === desc);
      if (matched) {
        blockGuidToMasterPort.set(nObj.m_ObjectId, matched.portId);
        // Extract default value from block's slot
        const slotRef = nObj.m_Slots?.[0]?.m_Id;
        const slotObj = slotRef ? byObjectId.get(slotRef) : null;
        if (slotObj && slotObj.m_Value !== undefined) {
          if (matched.slotType.includes('ColorRGB') && typeof slotObj.m_Value === 'object') {
            masterNode.inputValues[matched.portId] = rgbToHex(
              slotObj.m_Value.x ?? 0.5,
              slotObj.m_Value.y ?? 0.5,
              slotObj.m_Value.z ?? 0.5
            );
          } else if (typeof slotObj.m_Value === 'number') {
            masterNode.inputValues[matched.portId] = slotObj.m_Value;
          }
        }
      }
      continue;
    }

    const pos = nObj.m_DrawState?.m_Position || { x: 100, y: 100 };
    const nodeId = `node_${nObj.m_ObjectId.slice(0, 8)}`;

    if (nObj.m_Type === 'UnityEditor.ShaderGraph.PropertyNode') {
      const propGuid = nObj.m_Property?.m_Id;
      const propId = propGuid ? propGuidToId.get(propGuid) : properties[0]?.id;
      const gNode: GraphNode = {
        id: nodeId,
        typeId: 'property',
        propertyId: propId,
        position: { x: pos.x ?? 100, y: pos.y ?? 100 },
        previewExpanded: false,
        inputValues: {},
        settings: {},
      };
      nodes.push(gNode);
      unityNodeGuidToGraphNode.set(nObj.m_ObjectId, gNode);
      continue;
    }

    const matchedDef = UNITY_TYPE_TO_NODE_DEF.get(nObj.m_Type);
    if (matchedDef) {
      const inputValues: Record<string, any> = {};
      const settings: Record<string, any> = { ...(nObj.m_WebSettings || {}) };

      // Extract slot values
      for (const sRef of nObj.m_Slots || []) {
        const sObj = byObjectId.get(sRef.m_Id);
        if (!sObj) continue;
        const portDef = matchedDef.inputs.find((p) => p.slotId === sObj.m_Id);
        if (portDef && sObj.m_Value !== undefined) {
          if (typeof sObj.m_Value === 'number') {
            inputValues[portDef.id] = sObj.m_Value;
          } else if (typeof sObj.m_Value === 'object' && sObj.m_Value !== null) {
            if (portDef.type === '1' || portDef.type === 'dynamic') {
              inputValues[portDef.id] = sObj.m_Value.x ?? 0;
            } else if (portDef.type === '2') {
              inputValues[portDef.id] = [sObj.m_Value.x ?? 0, sObj.m_Value.y ?? 0];
            } else if (portDef.type === '3') {
              inputValues[portDef.id] = [
                sObj.m_Value.x ?? 0,
                sObj.m_Value.y ?? 0,
                sObj.m_Value.z ?? 0,
              ];
            } else if (portDef.type === '4') {
              inputValues[portDef.id] = [
                sObj.m_Value.x ?? 0,
                sObj.m_Value.y ?? 0,
                sObj.m_Value.z ?? 0,
                sObj.m_Value.w ?? 1,
              ];
            }
          }
        }
      }

      if (matchedDef.typeId === 'color' && nObj.m_Color?.color) {
        const c = nObj.m_Color.color;
        settings.color = rgbToHex(c.r ?? 0, c.g ?? 0.8, c.b ?? 1);
      }

      const gNode: GraphNode = {
        id: nodeId,
        typeId: matchedDef.typeId,
        position: { x: pos.x ?? 100, y: pos.y ?? 100 },
        previewExpanded: Boolean(nObj.m_PreviewExpanded),
        inputValues,
        settings,
      };
      nodes.push(gNode);
      unityNodeGuidToGraphNode.set(nObj.m_ObjectId, gNode);
    } else {
      // Unknown Unity node -> preserve as passthrough placeholder node
      const shortName =
        nObj.m_Name || String(nObj.m_Type || 'UnityNode').split('.').pop() || 'Unity Node';
      const gNode: GraphNode = {
        id: nodeId,
        typeId: 'unknown-unity',
        position: { x: pos.x ?? 100, y: pos.y ?? 100 },
        previewExpanded: false,
        inputValues: {},
        settings: {},
        unknownUnityData: {
          unityType: nObj.m_Type,
          title: shortName,
          rawJson: nObj,
        },
      };
      nodes.push(gNode);
      unityNodeGuidToGraphNode.set(nObj.m_ObjectId, gNode);
    }
  }

  // 3. Parse Edges
  const edges: GraphEdge[] = [];
  let edgeIndex = 0;

  for (const uEdge of root.m_Edges || []) {
    const srcGuid = uEdge.m_OutputSlot?.m_Node?.m_Id;
    const srcSlotId = uEdge.m_OutputSlot?.m_SlotId;
    const tgtGuid = uEdge.m_InputSlot?.m_Node?.m_Id;
    const tgtSlotId = uEdge.m_InputSlot?.m_SlotId;

    const srcNode = srcGuid ? unityNodeGuidToGraphNode.get(srcGuid) : undefined;
    if (!srcNode) continue;

    const srcDef = getNodeDefinition(srcNode, properties);
    const srcPort =
      srcDef.outputs.find((p) => p.slotId === srcSlotId) || srcDef.outputs[0];
    if (!srcPort) continue;

    // Check if target is a Master BlockNode
    const masterPortId = tgtGuid ? blockGuidToMasterPort.get(tgtGuid) : undefined;
    if (masterPortId) {
      edges.push({
        id: `edge_${++edgeIndex}`,
        sourceNodeId: srcNode.id,
        sourcePortId: srcPort.id,
        targetNodeId: masterNode.id,
        targetPortId: masterPortId,
      });
      continue;
    }

    const tgtNode = tgtGuid ? unityNodeGuidToGraphNode.get(tgtGuid) : undefined;
    if (!tgtNode) continue;

    const tgtDef = getNodeDefinition(tgtNode, properties);
    const tgtPort =
      tgtDef.inputs.find((p) => p.slotId === tgtSlotId) || tgtDef.inputs[0];
    if (!tgtPort) continue;

    edges.push({
      id: `edge_${++edgeIndex}`,
      sourceNodeId: srcNode.id,
      sourcePortId: srcPort.id,
      targetNodeId: tgtNode.id,
      targetPortId: tgtPort.id,
    });
  }

  // 4. Parse Groups & Sticky Notes
  const groups: GraphGroup[] = [];
  for (const gRef of root.m_GroupDatas || []) {
    const gObj = byObjectId.get(gRef.m_Id);
    if (!gObj) continue;
    const pos = gObj.m_Position || {};
    groups.push({
      id: `group_${gObj.m_ObjectId.slice(0, 8)}`,
      title: gObj.m_Title || 'Group',
      color: '#38bdf8',
      position: { x: pos.x ?? 0, y: pos.y ?? 0 },
      size: { width: pos.width ?? 400, height: pos.height ?? 260 },
    });
  }

  const stickyNotes: StickyNote[] = [];
  for (const sRef of root.m_StickyNoteDatas || []) {
    const sObj = byObjectId.get(sRef.m_Id);
    if (!sObj) continue;
    const pos = sObj.m_Position || {};
    stickyNotes.push({
      id: `note_${sObj.m_ObjectId.slice(0, 8)}`,
      title: sObj.m_Title || 'Note',
      content: sObj.m_Content || '',
      position: { x: pos.x ?? 0, y: pos.y ?? 0 },
      size: { width: pos.width ?? 220, height: pos.height ?? 140 },
      theme: 'amber',
    });
  }

  // 5. Parse Target settings
  const targetRef = root.m_ActiveTargets?.[0]?.m_Id;
  const targetObj = targetRef ? byObjectId.get(targetRef) : null;
  const subTargetRef = targetObj?.m_ActiveSubTarget?.m_Id;
  const subTargetObj = subTargetRef ? byObjectId.get(subTargetRef) : null;
  const isUnlit = String(subTargetObj?.m_Type || '').includes('Unlit');

  return {
    id: `proj_${Date.now()}`,
    name: cleanName,
    updatedAt: Date.now(),
    settings: {
      pipeline: 'URP',
      subTarget: isUnlit ? 'Unlit' : 'Lit',
      surfaceType: targetObj?.m_SurfaceType === 1 ? 'Transparent' : 'Opaque',
      blendMode: 'Alpha',
      renderFace:
        targetObj?.m_RenderFace === 0
          ? 'Both'
          : targetObj?.m_RenderFace === 1
          ? 'Back'
          : 'Front',
      alphaClip: Boolean(targetObj?.m_AlphaClip),
      alphaClipThreshold: 0.5,
      castShadows: targetObj?.m_CastShadows !== false,
    },
    nodes,
    edges,
    properties,
    groups,
    stickyNotes,
  };
}

export { NODE_DEFINITION_MAP };
