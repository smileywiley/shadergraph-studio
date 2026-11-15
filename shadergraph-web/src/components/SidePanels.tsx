import React, { useState } from 'react';
import {
  ShaderGraphProject,
  BlackboardProperty,
  BlackboardPropertyType,
  GraphSettings,
  GraphNode,
} from '../types/shadergraph';
import { getNodeDefinition } from '../nodes/nodeRegistry';
import { getAllTextureEntries, registerUploadedTexture } from '../utils/textureManager';
import {
  Sliders,
  Settings,
  Plus,
  Trash2,
  ArrowRightCircle,
  Upload,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react';

interface SidePanelsProps {
  project: ShaderGraphProject;
  selectedNode?: GraphNode;
  activeTab: 'blackboard' | 'inspector';
  onTabChange: (tab: 'blackboard' | 'inspector') => void;
  onAddProperty: (type: BlackboardPropertyType) => void;
  onUpdateProperty: (id: string, patch: Partial<BlackboardProperty>) => void;
  onRemoveProperty: (id: string) => void;
  onInsertPropertyNode: (propertyId: string) => void;
  onUpdateGraphSettings: (patch: Partial<GraphSettings>) => void;
  onUpdateNodeInput: (nodeId: string, portId: string, value: any) => void;
  onUpdateNodeSetting: (nodeId: string, key: string, value: any) => void;
}

export const SidePanels: React.FC<SidePanelsProps> = ({
  project,
  selectedNode,
  activeTab,
  onTabChange,
  onAddProperty,
  onUpdateProperty,
  onRemoveProperty,
  onInsertPropertyNode,
  onUpdateGraphSettings,
  onUpdateNodeInput,
  onUpdateNodeSetting,
}) => {
  const [newPropType, setNewPropType] = useState<BlackboardPropertyType>('float');
  const textureList = getAllTextureEntries();

  const selectedDef = selectedNode
    ? getNodeDefinition(selectedNode, project.properties)
    : null;

  return (
    <aside className="sg-sidepanel" id="blackboard-inspector-panel">
      {/* Panel Switcher Tabs */}
      <div className="sg-sidepanel-tabs">
        <button
          type="button"
          className={`sg-sidepanel-tab ${activeTab === 'blackboard' ? 'active' : ''}`}
          onClick={() => onTabChange('blackboard')}
        >
          <Sliders size={14} />
          <span>Blackboard</span>
          <span className="sg-tab-count">{project.properties.length}</span>
        </button>
        <button
          type="button"
          className={`sg-sidepanel-tab ${activeTab === 'inspector' ? 'active' : ''}`}
          onClick={() => onTabChange('inspector')}
        >
          <Settings size={14} />
          <span>Graph Inspector</span>
        </button>
      </div>

      {/* =========================================
          TAB 1: UNITY BLACKBOARD
         ========================================= */}
      {activeTab === 'blackboard' && (
        <div className="sg-sidepanel-content">
          <div className="sg-blackboard-subhead">
            <div>
              <div className="sg-shader-path">Shader Graphs / {project.name}</div>
              <div className="sg-shader-sub">
                URP {project.settings.subTarget} · {project.settings.surfaceType}
              </div>
            </div>

            <div className="sg-add-prop-bar">
              <select
                value={newPropType}
                onChange={(e) =>
                  setNewPropType(e.target.value as BlackboardPropertyType)
                }
                className="sg-prop-type-select"
              >
                <option value="float">Float</option>
                <option value="color">Color</option>
                <option value="vector2">Vector2</option>
                <option value="vector3">Vector3</option>
                <option value="vector4">Vector4</option>
                <option value="texture2d">Texture2D</option>
                <option value="boolean">Boolean</option>
              </select>
              <button
                type="button"
                className="sg-btn-add-prop"
                onClick={() => onAddProperty(newPropType)}
                title="Add Exposed Shader Property"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="sg-prop-list">
            {project.properties.map((prop) => (
              <div key={prop.id} className="sg-prop-card">
                <div className="sg-prop-card-top">
                  <button
                    type="button"
                    className={`sg-prop-expose-btn ${prop.exposed ? 'exposed' : ''}`}
                    onClick={() =>
                      onUpdateProperty(prop.id, { exposed: !prop.exposed })
                    }
                    title={
                      prop.exposed
                        ? 'Exposed in Unity Material Inspector'
                        : 'Hidden from Material Inspector'
                    }
                  >
                    {prop.exposed ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>

                  <input
                    type="text"
                    className="sg-prop-name-input"
                    value={prop.name}
                    onChange={(e) =>
                      onUpdateProperty(prop.id, { name: e.target.value })
                    }
                    placeholder="Property Name"
                  />

                  <span className="sg-prop-type-tag">{prop.type}</span>

                  <button
                    type="button"
                    className="sg-prop-insert-btn"
                    onClick={() => onInsertPropertyNode(prop.id)}
                    title="Place Property Node onto Graph Canvas"
                  >
                    <ArrowRightCircle size={13} />
                    <span>Graph</span>
                  </button>

                  <button
                    type="button"
                    className="sg-node-mini-btn sg-node-delete-btn"
                    onClick={() => onRemoveProperty(prop.id)}
                    title="Delete Property"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Reference Name Row */}
                <div className="sg-prop-ref-row">
                  <span>Reference</span>
                  <input
                    type="text"
                    className="sg-prop-ref-input"
                    value={prop.referenceName}
                    onChange={(e) =>
                      onUpdateProperty(prop.id, { referenceName: e.target.value })
                    }
                  />
                </div>

                {/* Live Value Control */}
                <div className="sg-prop-val-row">
                  {prop.type === 'float' && (
                    <div className="sg-prop-slider-wrap">
                      <input
                        type="range"
                        min={prop.rangeMin ?? 0}
                        max={prop.rangeMax ?? 10}
                        step={0.02}
                        value={Number(prop.value) || 0}
                        onChange={(e) =>
                          onUpdateProperty(prop.id, {
                            value: parseFloat(e.target.value),
                          })
                        }
                      />
                      <input
                        type="number"
                        step="0.05"
                        className="sg-inline-num"
                        value={Number(prop.value) || 0}
                        onChange={(e) =>
                          onUpdateProperty(prop.id, {
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  )}

                  {prop.type === 'color' && (
                    <div className="sg-prop-color-wrap">
                      <input
                        type="color"
                        className="sg-inline-color"
                        value={prop.value || '#00e5ff'}
                        onChange={(e) =>
                          onUpdateProperty(prop.id, { value: e.target.value })
                        }
                      />
                      <span className="sg-color-hex">{prop.value}</span>
                      <select
                        value={prop.mode || 'Default'}
                        onChange={(e) =>
                          onUpdateProperty(prop.id, {
                            mode: e.target.value as 'Default' | 'HDR',
                          })
                        }
                        className="sg-mini-select"
                      >
                        <option value="Default">Default</option>
                        <option value="HDR">HDR</option>
                      </select>
                    </div>
                  )}

                  {prop.type === 'boolean' && (
                    <label className="sg-checkbox-label">
                      <input
                        type="checkbox"
                        checked={Boolean(prop.value)}
                        onChange={(e) =>
                          onUpdateProperty(prop.id, { value: e.target.checked })
                        }
                      />
                      <span>{prop.value ? 'True (On)' : 'False (Off)'}</span>
                    </label>
                  )}

                  {(prop.type === 'vector2' ||
                    prop.type === 'vector3' ||
                    prop.type === 'vector4') && (
                    <div className="sg-inline-vec">
                      {(prop.type === 'vector2'
                        ? [0, 1]
                        : prop.type === 'vector3'
                        ? [0, 1, 2]
                        : [0, 1, 2, 3]
                      ).map((idx) => {
                        const arr = Array.isArray(prop.value)
                          ? prop.value
                          : [0, 0, 0, 1];
                        return (
                          <input
                            key={idx}
                            type="number"
                            step="0.1"
                            className="sg-inline-num sg-inline-num-sm"
                            value={arr[idx] ?? 0}
                            onChange={(e) => {
                              const next = [...arr];
                              next[idx] = parseFloat(e.target.value) || 0;
                              onUpdateProperty(prop.id, { value: next });
                            }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {prop.type === 'texture2d' && (
                    <div className="sg-setting-col" style={{ width: '100%' }}>
                      <select
                        value={prop.value || 'uvgrid'}
                        onChange={(e) =>
                          onUpdateProperty(prop.id, { value: e.target.value })
                        }
                      >
                        {textureList.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <label className="sg-upload-tex-btn">
                        <Upload size={11} />
                        <span>Upload Custom Texture</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const entry = await registerUploadedTexture(file);
                              onUpdateProperty(prop.id, { value: entry.key });
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {project.properties.length === 0 && (
              <div className="sg-empty-state">
                No Blackboard properties yet. Use the "+ Add" button above to expose shader uniforms.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================
          TAB 2: GRAPH & NODE INSPECTOR
         ========================================= */}
      {activeTab === 'inspector' && (
        <div className="sg-sidepanel-content">
          {/* Selected Node Section */}
          {selectedNode && selectedDef && (
            <div className="sg-inspector-section">
              <div className="sg-inspector-heading">
                <Layers size={13} />
                <span>Node Settings: {selectedDef.title}</span>
              </div>
              <div className="sg-inspector-meta">
                <code>{selectedDef.unityType}</code>
                <p>{selectedDef.description}</p>
              </div>

              {selectedDef.inputs.map((inp) => {
                const isConnected = project.edges.some(
                  (e) =>
                    e.targetNodeId === selectedNode.id &&
                    e.targetPortId === inp.id
                );
                if (isConnected) return null;
                const val =
                  selectedNode.inputValues?.[inp.id] ?? inp.defaultValue;
                return (
                  <div key={inp.id} className="sg-inspector-row">
                    <label>{inp.name}</label>
                    {inp.type === 'color' ? (
                      <input
                        type="color"
                        className="sg-inline-color"
                        value={typeof val === 'string' ? val : '#4ca6ff'}
                        onChange={(e) =>
                          onUpdateNodeInput(
                            selectedNode.id,
                            inp.id,
                            e.target.value
                          )
                        }
                      />
                    ) : typeof val === 'number' ? (
                      <input
                        type="number"
                        step="0.05"
                        className="sg-inline-num"
                        value={val}
                        onChange={(e) =>
                          onUpdateNodeInput(
                            selectedNode.id,
                            inp.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    ) : null}
                  </div>
                );
              })}

              {selectedDef.settings?.map((st) => {
                const val =
                  selectedNode.settings?.[st.key] ?? st.defaultValue;
                return (
                  <div key={st.key} className="sg-inspector-row">
                    <label>{st.label}</label>
                    {st.type === 'select' && st.options ? (
                      <select
                        value={val}
                        onChange={(e) =>
                          onUpdateNodeSetting(
                            selectedNode.id,
                            st.key,
                            e.target.value
                          )
                        }
                      >
                        {st.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : st.type === 'color' ? (
                      <input
                        type="color"
                        className="sg-inline-color"
                        value={val || '#00d2ff'}
                        onChange={(e) =>
                          onUpdateNodeSetting(
                            selectedNode.id,
                            st.key,
                            e.target.value
                          )
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        className="sg-inline-text"
                        value={String(val ?? '')}
                        onChange={(e) =>
                          onUpdateNodeSetting(
                            selectedNode.id,
                            st.key,
                            e.target.value
                          )
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Graph Settings Section */}
          <div className="sg-inspector-section">
            <div className="sg-inspector-heading">
              <Settings size={13} />
              <span>Graph Settings (Universal Target)</span>
            </div>

            <div className="sg-inspector-row">
              <label>Material</label>
              <select
                value={project.settings.subTarget}
                onChange={(e) =>
                  onUpdateGraphSettings({
                    subTarget: e.target.value as 'Lit' | 'Unlit',
                  })
                }
              >
                <option value="Lit">Lit (PBR)</option>
                <option value="Unlit">Unlit</option>
              </select>
            </div>

            <div className="sg-inspector-row">
              <label>Surface Type</label>
              <select
                value={project.settings.surfaceType}
                onChange={(e) =>
                  onUpdateGraphSettings({
                    surfaceType: e.target.value as 'Opaque' | 'Transparent',
                  })
                }
              >
                <option value="Opaque">Opaque</option>
                <option value="Transparent">Transparent</option>
              </select>
            </div>

            {project.settings.surfaceType === 'Transparent' && (
              <div className="sg-inspector-row">
                <label>Blending Mode</label>
                <select
                  value={project.settings.blendMode}
                  onChange={(e) =>
                    onUpdateGraphSettings({
                      blendMode: e.target.value as GraphSettings['blendMode'],
                    })
                  }
                >
                  <option value="Alpha">Alpha</option>
                  <option value="Premultiply">Premultiply</option>
                  <option value="Additive">Additive</option>
                  <option value="Multiply">Multiply</option>
                </select>
              </div>
            )}

            <div className="sg-inspector-row">
              <label>Render Face</label>
              <select
                value={project.settings.renderFace}
                onChange={(e) =>
                  onUpdateGraphSettings({
                    renderFace: e.target.value as GraphSettings['renderFace'],
                  })
                }
              >
                <option value="Front">Front (Cull Back)</option>
                <option value="Back">Back (Cull Front)</option>
                <option value="Both">Both (Two-Sided)</option>
              </select>
            </div>

            <div className="sg-inspector-row">
              <label>Alpha Clipping</label>
              <input
                type="checkbox"
                checked={project.settings.alphaClip}
                onChange={(e) =>
                  onUpdateGraphSettings({ alphaClip: e.target.checked })
                }
              />
            </div>

            <div className="sg-inspector-row">
              <label>Cast Shadows</label>
              <input
                type="checkbox"
                checked={project.settings.castShadows}
                onChange={(e) =>
                  onUpdateGraphSettings({ castShadows: e.target.checked })
                }
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
