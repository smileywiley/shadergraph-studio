import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShaderGraphProject,
  GraphNode,
  BlackboardProperty,
  BlackboardPropertyType,
  GraphSettings,
  ResolvedPortType,
} from './types/shadergraph';
import { STARTER_TEMPLATES } from './templates/starterTemplates';
import { getNodeDefinition } from './nodes/nodeRegistry';
import { resolveGraphOrderAndPorts } from './compiler/shaderCompiler';
import {
  exportToUnityShaderGraph,
  importShaderGraphFile,
} from './compiler/unityShaderGraphIO';
import { GraphCanvas, type GroupBoundsPatch } from './components/GraphCanvas';
import { MainPreview3D } from './components/MainPreview3D';
import { SidePanels } from './components/SidePanels';
import { AddNodeModal } from './components/AddNodeModal';
import { ExportModal, triggerFileDownload } from './components/ExportModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { initBuiltinTextures } from './utils/textureManager';
import {
  getDiagnostics,
  installGlobalDiagnosticListeners,
  onDiagnosticErrorAutoOpen,
  subscribeDiagnostics,
} from './utils/diagnosticsStore';
import {
  Undo2,
  Redo2,
  Download,
  Upload,
  Plus,
  Sliders,
  Settings,
  Sparkles,
  FolderOpen,
  Code2,
  PanelLeftClose,
  PanelLeftOpen,
  FilePlus2,
  Check,
  AlertTriangle,
  Activity,
} from 'lucide-react';

const STORAGE_KEY_ACTIVE = 'unity_shadergraph_web_active_v2';
const STORAGE_KEY_SAVED_LIST = 'unity_shadergraph_web_saved_v1';

function cloneProject(p: ShaderGraphProject): ShaderGraphProject {
  return JSON.parse(JSON.stringify(p));
}

export function App() {
  useEffect(() => {
    installGlobalDiagnosticListeners();
    initBuiltinTextures();
  }, []);

  // Load initial project from URL hash or LocalStorage or default template
  const [project, setProject] = useState<ShaderGraphProject>(() => {
    try {
      const hash = window.location.hash;
      if (hash.startsWith('#graph=')) {
        const raw = decodeURIComponent(atob(hash.slice('#graph='.length)));
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.nodes)) {
          return parsed;
        }
      }
      const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        if (parsed && Array.isArray(parsed.nodes)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to default template
    }
    return cloneProject(STARTER_TEMPLATES[0]);
  });

  const [savedProjects, setSavedProjects] = useState<ShaderGraphProject[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SAVED_LIST);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Undo / Redo stacks
  const [past, setPast] = useState<ShaderGraphProject[]>([]);
  const [future, setFuture] = useState<ShaderGraphProject[]>([]);

  // Selection & UI state
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState<boolean>(true);
  const [sideTab, setSideTab] = useState<'blackboard' | 'inspector'>('blackboard');
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth <= 860);
  const [mobileSheet, setMobileSheet] = useState<
    'none' | 'blackboard' | 'inspector' | 'templates'
  >('none');
  const [pipMinimized, setPipMinimized] = useState<boolean>(false);

  // Modals
  const [addNodeOpen, setAddNodeOpen] = useState<boolean>(false);
  const [addNodeSpawnPos, setAddNodeSpawnPos] = useState<{ x: number; y: number }>({
    x: 320,
    y: 220,
  });
  const [pendingConnectPort, setPendingConnectPort] = useState<
    | {
        nodeId: string;
        portId: string;
        direction: 'input' | 'output';
        portType: ResolvedPortType;
      }
    | undefined
  >(undefined);

  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportModalTab, setExportModalTab] = useState<
    'shadergraph' | 'shaderlab' | 'glsl' | 'import'
  >('shadergraph');
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState<boolean>(false);
  const [diagErrorCount, setDiagErrorCount] = useState<number>(0);
  const [templatesDropdownOpen, setTemplatesDropdownOpen] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const updateCounts = () => {
      const errs = getDiagnostics().filter((d) => d.level === 'error').length;
      setDiagErrorCount(errs);
    };
    updateCounts();
    const unsubDiag = subscribeDiagnostics(updateCounts);
    const unsubAuto = onDiagnosticErrorAutoOpen(() => {
      setDiagnosticsModalOpen(true);
    });
    return () => {
      unsubDiag();
      unsubAuto();
    };
  }, []);

  // Responsive breakpoint listener
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 860);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Auto-save active project to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(project));
    } catch {
      // ignore quota error
    }
  }, [project]);

  const commitChange = useCallback(
    (updater: (prev: ShaderGraphProject) => ShaderGraphProject) => {
      setProject((prev) => {
        const next = updater(cloneProject(prev));
        next.updatedAt = Date.now();
        setPast((h) => [...h.slice(-29), prev]);
        setFuture([]);
        return next;
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setFuture((f) => [project, ...f]);
      setProject(previous);
      return prevPast.slice(0, -1);
    });
  }, [project]);

  const handleRedo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      setPast((p) => [...p, project]);
      setProject(next);
      return prevFuture.slice(1);
    });
  }, [project]);

  // Keyboard shortcuts for Undo / Redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const { portResolutions } = useMemo(
    () => resolveGraphOrderAndPorts(project),
    [project]
  );

  // Node position update (without flooding undo history on every pixel move)
  const handleUpdateNodePosition = useCallback(
    (
      nodeId: string,
      x: number,
      y: number,
      groupBoundsPatches?: GroupBoundsPatch[]
    ) => {
      setProject((prev) => {
        const patchMap =
          groupBoundsPatches && groupBoundsPatches.length > 0
            ? new Map(groupBoundsPatches.map((p) => [p.id, p]))
            : null;
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId ? { ...n, position: { x, y } } : n
          ),
          groups: patchMap
            ? prev.groups.map((g) => {
                const gp = patchMap.get(g.id);
                return gp
                  ? {
                      ...g,
                      position: { x: gp.x, y: gp.y },
                      size: { width: gp.width, height: gp.height },
                    }
                  : g;
              })
            : prev.groups,
        };
      });
    },
    []
  );

  const handleUpdateNodeInput = useCallback(
    (nodeId: string, portId: string, value: any) => {
      commitChange((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, inputValues: { ...n.inputValues, [portId]: value } }
            : n
        ),
      }));
    },
    [commitChange]
  );

  const handleUpdateNodeSetting = useCallback(
    (nodeId: string, key: string, value: any) => {
      commitChange((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, settings: { ...n.settings, [key]: value } }
            : n
        ),
      }));
    },
    [commitChange]
  );

  const handleToggleNodePreview = useCallback((nodeId: string) => {
    setProject((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId ? { ...n, previewExpanded: !n.previewExpanded } : n
      ),
    }));
  }, []);

  const handleConnectPorts = useCallback(
    (
      sourceNodeId: string,
      sourcePortId: string,
      targetNodeId: string,
      targetPortId: string
    ) => {
      if (sourceNodeId === targetNodeId) return;
      commitChange((prev) => {
        // Remove any existing edge feeding into the same target input port
        const filtered = prev.edges.filter(
          (e) =>
            !(
              e.targetNodeId === targetNodeId && e.targetPortId === targetPortId
            )
        );
        return {
          ...prev,
          edges: [
            ...filtered,
            {
              id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              sourceNodeId,
              sourcePortId,
              targetNodeId,
              targetPortId,
            },
          ],
        };
      });
    },
    [commitChange]
  );

  const handleRemoveEdge = useCallback(
    (edgeId: string) => {
      commitChange((prev) => ({
        ...prev,
        edges: prev.edges.filter((e) => e.id !== edgeId),
      }));
    },
    [commitChange]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      commitChange((prev) => {
        const target = prev.nodes.find((n) => n.id === nodeId);
        if (!target || target.typeId === 'master-lit') return prev;
        return {
          ...prev,
          nodes: prev.nodes.filter((n) => n.id !== nodeId),
          edges: prev.edges.filter(
            (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
          ),
        };
      });
      setSelectedNodeIds((ids) => ids.filter((id) => id !== nodeId));
    },
    [commitChange]
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      commitChange((prev) => {
        const orig = prev.nodes.find((n) => n.id === nodeId);
        if (!orig || orig.typeId === 'master-lit') return prev;
        const copyId = `n_${Date.now().toString(36)}`;
        const copy: GraphNode = {
          ...JSON.parse(JSON.stringify(orig)),
          id: copyId,
          position: { x: orig.position.x + 40, y: orig.position.y + 40 },
        };
        return {
          ...prev,
          nodes: [...prev.nodes, copy],
        };
      });
    },
    [commitChange]
  );

  const handleOpenAddNodeAt = useCallback(
    (
      canvasPos: { x: number; y: number },
      pendingPort?: {
        nodeId: string;
        portId: string;
        direction: 'input' | 'output';
        portType: ResolvedPortType;
      }
    ) => {
      setAddNodeSpawnPos(canvasPos);
      setPendingConnectPort(pendingPort);
      setAddNodeOpen(true);
    },
    []
  );

  const handleAddNode = useCallback(
    (typeId: string, propertyId?: string) => {
      const newNodeId = `n_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 5)}`;

      commitChange((prev) => {
        const newNode: GraphNode = {
          id: newNodeId,
          typeId,
          propertyId,
          position: {
            x: Math.round(addNodeSpawnPos.x),
            y: Math.round(addNodeSpawnPos.y),
          },
          previewExpanded: ![
            'float',
            'vector2',
            'vector3',
            'vector4',
            'time',
            'split',
            'property',
          ].includes(typeId),
          inputValues: {},
          settings: {},
        };

        const nextEdges = [...prev.edges];
        if (pendingConnectPort) {
          const def = getNodeDefinition(newNode, prev.properties);
          if (pendingConnectPort.direction === 'output' && def.inputs.length > 0) {
            nextEdges.push({
              id: `e_${Date.now()}`,
              sourceNodeId: pendingConnectPort.nodeId,
              sourcePortId: pendingConnectPort.portId,
              targetNodeId: newNodeId,
              targetPortId: def.inputs[0].id,
            });
          } else if (
            pendingConnectPort.direction === 'input' &&
            def.outputs.length > 0
          ) {
            const cleaned = nextEdges.filter(
              (e) =>
                !(
                  e.targetNodeId === pendingConnectPort.nodeId &&
                  e.targetPortId === pendingConnectPort.portId
                )
            );
            cleaned.push({
              id: `e_${Date.now()}`,
              sourceNodeId: newNodeId,
              sourcePortId: def.outputs[0].id,
              targetNodeId: pendingConnectPort.nodeId,
              targetPortId: pendingConnectPort.portId,
            });
            return {
              ...prev,
              nodes: [...prev.nodes, newNode],
              edges: cleaned,
            };
          }
        }

        return {
          ...prev,
          nodes: [...prev.nodes, newNode],
          edges: nextEdges,
        };
      });

      setSelectedNodeIds([newNodeId]);
      setPendingConnectPort(undefined);
    },
    [addNodeSpawnPos, pendingConnectPort, commitChange]
  );

  // Blackboard property handlers
  const handleAddProperty = useCallback(
    (type: BlackboardPropertyType) => {
      commitChange((prev) => {
        const count = prev.properties.length + 1;
        const defaultValues: Record<BlackboardPropertyType, any> = {
          float: 1.0,
          color: '#00e5ff',
          vector2: [1, 1],
          vector3: [0, 1, 0],
          vector4: [0, 0, 0, 1],
          texture2d: 'uvgrid',
          boolean: true,
        };
        const newProp: BlackboardProperty = {
          id: `prop_${Date.now().toString(36)}`,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)}_${count}`,
          referenceName: `_${type.charAt(0).toUpperCase() + type.slice(1)}_${count}`,
          type,
          value: defaultValues[type],
          exposed: true,
          mode: type === 'float' ? 'Slider' : 'Default',
          rangeMin: 0,
          rangeMax: 5,
        };
        return {
          ...prev,
          properties: [...prev.properties, newProp],
        };
      });
    },
    [commitChange]
  );

  const handleUpdateProperty = useCallback(
    (id: string, patch: Partial<BlackboardProperty>) => {
      setProject((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === id ? { ...p, ...patch } : p
        ),
      }));
    },
    []
  );

  const handleRemoveProperty = useCallback(
    (id: string) => {
      commitChange((prev) => ({
        ...prev,
        properties: prev.properties.filter((p) => p.id !== id),
        nodes: prev.nodes.filter((n) => n.propertyId !== id),
      }));
    },
    [commitChange]
  );

  const handleInsertPropertyNode = useCallback(
    (propertyId: string) => {
      setAddNodeSpawnPos({
        x: 180 + Math.round(Math.random() * 120),
        y: 160 + Math.round(Math.random() * 140),
      });
      handleAddNode('property', propertyId);
      if (isMobile) setMobileSheet('none');
    },
    [handleAddNode, isMobile]
  );

  const handleUpdateGraphSettings = useCallback(
    (patch: Partial<GraphSettings>) => {
      commitChange((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }));
    },
    [commitChange]
  );

  // Groups & Sticky notes
  const handleAddGroup = useCallback(() => {
    commitChange((prev) => ({
      ...prev,
      groups: [
        ...prev.groups,
        {
          id: `grp_${Date.now().toString(36)}`,
          title: 'Node Group',
          color: '#38bdf8',
          position: { x: addNodeSpawnPos.x - 20, y: addNodeSpawnPos.y - 20 },
          size: { width: 420, height: 260 },
        },
      ],
    }));
  }, [addNodeSpawnPos, commitChange]);

  const handleAddStickyNote = useCallback(() => {
    commitChange((prev) => ({
      ...prev,
      stickyNotes: [
        ...prev.stickyNotes,
        {
          id: `note_${Date.now().toString(36)}`,
          title: 'Shader Note',
          content: 'Document shader math or instructions here...',
          position: { x: addNodeSpawnPos.x, y: addNodeSpawnPos.y },
          size: { width: 210, height: 130 },
          theme: 'amber',
        },
      ],
    }));
  }, [addNodeSpawnPos, commitChange]);

  const handleSaveToBrowserList = () => {
    setSavedProjects((prev) => {
      const copy = cloneProject(project);
      const exists = prev.some((p) => p.id === copy.id);
      const next = exists
        ? prev.map((p) => (p.id === copy.id ? copy : p))
        : [copy, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY_SAVED_LIST, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  const handleNewBlankGraph = () => {
    const blank: ShaderGraphProject = {
      id: `proj_${Date.now().toString(36)}`,
      name: 'New Shader Graph',
      updatedAt: Date.now(),
      settings: {
        pipeline: 'URP',
        subTarget: 'Lit',
        surfaceType: 'Opaque',
        blendMode: 'Alpha',
        renderFace: 'Front',
        alphaClip: false,
        alphaClipThreshold: 0.5,
        castShadows: true,
      },
      properties: [
        {
          id: 'prop-base',
          name: 'Base Color',
          referenceName: '_BaseColor',
          type: 'color',
          value: '#38bdf8',
          exposed: true,
        },
      ],
      groups: [],
      stickyNotes: [],
      nodes: [
        {
          id: 'n-prop-base',
          typeId: 'property',
          propertyId: 'prop-base',
          position: { x: 180, y: 220 },
          previewExpanded: false,
          inputValues: {},
          settings: {},
        },
        {
          id: 'master-node',
          typeId: 'master-lit',
          position: { x: 520, y: 140 },
          previewExpanded: false,
          inputValues: {
            baseColor: '#38bdf8',
            metallic: 0.15,
            smoothness: 0.7,
          },
          settings: {},
        },
      ],
      edges: [
        {
          id: 'e-init',
          sourceNodeId: 'n-prop-base',
          sourcePortId: 'out',
          targetNodeId: 'master-node',
          targetPortId: 'baseColor',
        },
      ],
    };
    commitChange(() => blank);
    setTemplatesDropdownOpen(false);
    setMobileSheet('none');
  };

  const selectedNode = useMemo(
    () => project.nodes.find((n) => n.id === selectedNodeIds[0]),
    [project.nodes, selectedNodeIds]
  );

  const handleQuickExportUnityShaderGraph = () => {
    const safeName =
      (project.name || 'CustomShader')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/__+/g, '_') || 'CustomShader';
    const content = exportToUnityShaderGraph(project);
    triggerFileDownload(`${safeName}.shadergraph`, content);
  };

  return (
    <div className="sg-app-shell">
      {/* =========================================
          TOP STUDIO HEADER BAR
         ========================================= */}
      <header className="sg-topbar">
        <div className="sg-topbar-left">
          {!isMobile && (
            <button
              type="button"
              className="sg-icon-btn"
              onClick={() => setLeftSidebarOpen((o) => !o)}
              title={leftSidebarOpen ? 'Hide Blackboard Sidebar' : 'Show Blackboard Sidebar'}
            >
              {leftSidebarOpen ? (
                <PanelLeftClose size={16} />
              ) : (
                <PanelLeftOpen size={16} />
              )}
            </button>
          )}

          <div className="sg-brand">
            <div className="sg-brand-logo">SG</div>
            <h1 className="sg-brand-title">ShaderGraph Studio</h1>
          </div>

          <input
            id="project-name-input"
            type="text"
            className="sg-project-title-input"
            value={project.name}
            onChange={(e) =>
              setProject((prev) => ({ ...prev, name: e.target.value }))
            }
            aria-label="Shader Graph Name"
          />

          {/* Templates & Projects Dropdown (Desktop) */}
          {!isMobile && (
            <div className="sg-dropdown-wrap">
              <button
                type="button"
                className="sg-topbar-btn"
                onClick={() => setTemplatesDropdownOpen((o) => !o)}
              >
                <FolderOpen size={14} />
                <span>Templates & Saved</span>
              </button>

              {templatesDropdownOpen && (
                <div
                  className="sg-dropdown-menu"
                  onMouseLeave={() => setTemplatesDropdownOpen(false)}
                >
                  <div className="sg-dropdown-section-label">Actions</div>
                  <button
                    type="button"
                    className="sg-dropdown-item"
                    onClick={handleNewBlankGraph}
                  >
                    <FilePlus2 size={14} />
                    <div>
                      <div className="sg-dd-title">New Blank Shader Graph</div>
                      <div className="sg-dd-sub">Start fresh with URP Lit Master Stack</div>
                    </div>
                  </button>

                  <div className="sg-dropdown-section-label">
                    Built-In Unity Shader Templates
                  </div>
                  {STARTER_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="sg-dropdown-item"
                      onClick={() => {
                        commitChange(() => cloneProject(tpl));
                        setTemplatesDropdownOpen(false);
                      }}
                    >
                      <Sparkles size={14} />
                      <div>
                        <div className="sg-dd-title">{tpl.name}</div>
                        <div className="sg-dd-sub">{tpl.description}</div>
                      </div>
                    </button>
                  ))}

                  {savedProjects.length > 0 && (
                    <>
                      <div className="sg-dropdown-section-label">
                        Saved in Browser ({savedProjects.length})
                      </div>
                      {savedProjects.map((sp) => (
                        <button
                          key={sp.id}
                          type="button"
                          className="sg-dropdown-item"
                          onClick={() => {
                            commitChange(() => cloneProject(sp));
                            setTemplatesDropdownOpen(false);
                          }}
                        >
                          <FolderOpen size={14} />
                          <div>
                            <div className="sg-dd-title">{sp.name}</div>
                            <div className="sg-dd-sub">
                              {new Date(sp.updatedAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center / Right Actions */}
        <div className="sg-topbar-right">
          <div className="sg-history-group">
            <button
              type="button"
              className="sg-icon-btn"
              disabled={past.length === 0}
              onClick={handleUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="sg-icon-btn"
              disabled={future.length === 0}
              onClick={handleRedo}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={15} />
            </button>
          </div>

          {!isMobile && (
            <>
              <button
                type="button"
                className="sg-topbar-btn"
                onClick={handleSaveToBrowserList}
                title="Save Asset Snapshot in Browser"
              >
                {savedToast ? <Check size={14} /> : null}
                <span>{savedToast ? 'Saved!' : 'Save Asset'}</span>
              </button>

              <button
                type="button"
                className="sg-topbar-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Import Unity .shadergraph file"
              >
                <Upload size={14} />
                <span>Import</span>
              </button>

              <button
                type="button"
                className="sg-topbar-btn"
                onClick={() => {
                  setExportModalTab('shaderlab');
                  setExportModalOpen(true);
                }}
                title="View HLSL / ShaderLab & GLSL Code"
              >
                <Code2 size={14} />
                <span>View Shader Code</span>
              </button>
            </>
          )}

          <button
            type="button"
            id="topbar-diagnostics-btn"
            className="sg-topbar-btn"
            onClick={() => setDiagnosticsModalOpen(true)}
            title="WebGL & Shader Diagnostics / Error Log"
            style={
              diagErrorCount > 0
                ? {
                    borderColor: 'rgba(248, 113, 113, 0.7)',
                    background: 'rgba(239, 68, 68, 0.22)',
                    color: '#fca5a5',
                  }
                : undefined
            }
          >
            {diagErrorCount > 0 ? (
              <AlertTriangle size={14} color="#f87171" />
            ) : (
              <Activity size={14} color="#34d399" />
            )}
            <span>
              {diagErrorCount > 0
                ? `${diagErrorCount} Error${diagErrorCount > 1 ? 's' : ''}`
                : isMobile
                ? 'Diag'
                : 'Diagnostics'}
            </span>
          </button>

          <button
            type="button"
            id="topbar-export-btn"
            className="sg-topbar-btn sg-topbar-export-cta"
            onClick={() => {
              setExportModalTab('shadergraph');
              setExportModalOpen(true);
            }}
            title="Export to Unity (.shadergraph & .shader)"
          >
            <Download size={14} />
            <span>{isMobile ? 'Export' : 'Export .shadergraph'}</span>
          </button>

          {!isMobile && (
            <button
              type="button"
              className="sg-topbar-btn sg-quick-dl-btn"
              onClick={handleQuickExportUnityShaderGraph}
              title="1-Click Download .shadergraph File"
            >
              <Download size={13} />
              <span>.shadergraph</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".shadergraph,.json,text/plain"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const imported = importShaderGraphFile(
                    String(reader.result),
                    file.name
                  );
                  commitChange(() => imported);
                } catch (err: any) {
                  alert(err?.message || 'Could not import .shadergraph file.');
                }
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {/* =========================================
          MAIN WORKSPACE BODY
         ========================================= */}
      <main className="sg-workspace">
        {/* Desktop Left Dock: Blackboard + Graph Inspector */}
        {!isMobile && leftSidebarOpen && (
          <SidePanels
            project={project}
            selectedNode={selectedNode}
            activeTab={sideTab}
            onTabChange={setSideTab}
            onAddProperty={handleAddProperty}
            onUpdateProperty={handleUpdateProperty}
            onRemoveProperty={handleRemoveProperty}
            onInsertPropertyNode={handleInsertPropertyNode}
            onUpdateGraphSettings={handleUpdateGraphSettings}
            onUpdateNodeInput={handleUpdateNodeInput}
            onUpdateNodeSetting={handleUpdateNodeSetting}
          />
        )}

        {/* Interactive Node Graph Canvas */}
        <div className="sg-canvas-stage">
          <GraphCanvas
            project={project}
            portResolutions={portResolutions}
            selectedNodeIds={selectedNodeIds}
            onSelectNodes={(ids) => {
              setSelectedNodeIds(ids);
              if (ids.length > 0 && !isMobile) {
                // Keep current tab unless user switches
              }
            }}
            onUpdateNodePosition={handleUpdateNodePosition}
            onUpdateNodeInput={handleUpdateNodeInput}
            onUpdateNodeSetting={handleUpdateNodeSetting}
            onToggleNodePreview={handleToggleNodePreview}
            onConnectPorts={handleConnectPorts}
            onRemoveEdge={handleRemoveEdge}
            onDeleteNode={handleDeleteNode}
            onDuplicateNode={handleDuplicateNode}
            onOpenAddNodeAt={handleOpenAddNodeAt}
            onUpdateGroupPosition={(gid, x, y, childNodePositions, childNotePositions) => {
              setProject((prev) => {
                const nodePosMap = childNodePositions
                  ? new Map(childNodePositions.map((p) => [p.id, p]))
                  : null;
                const notePosMap = childNotePositions
                  ? new Map(childNotePositions.map((p) => [p.id, p]))
                  : null;
                return {
                  ...prev,
                  groups: prev.groups.map((g) =>
                    g.id === gid ? { ...g, position: { x, y } } : g
                  ),
                  nodes: nodePosMap
                    ? prev.nodes.map((n) => {
                        const np = nodePosMap.get(n.id);
                        return np ? { ...n, position: { x: np.x, y: np.y } } : n;
                      })
                    : prev.nodes,
                  stickyNotes: notePosMap
                    ? prev.stickyNotes.map((s) => {
                        const sp = notePosMap.get(s.id);
                        return sp ? { ...s, position: { x: sp.x, y: sp.y } } : s;
                      })
                    : prev.stickyNotes,
                };
              });
            }}
            onUpdateGroupBounds={(gid, x, y, width, height) => {
              setProject((prev) => ({
                ...prev,
                groups: prev.groups.map((g) =>
                  g.id === gid
                    ? { ...g, position: { x, y }, size: { width, height } }
                    : g
                ),
              }));
            }}
            onUpdateStickyNote={(nid, patch) => {
              setProject((prev) => ({
                ...prev,
                stickyNotes: prev.stickyNotes.map((s) =>
                  s.id === nid
                    ? {
                        ...s,
                        title: patch.title ?? s.title,
                        content: patch.content ?? s.content,
                        position: {
                          x: patch.x ?? s.position.x,
                          y: patch.y ?? s.position.y,
                        },
                      }
                    : s
                ),
              }));
            }}
            onDeleteGroup={(gid) =>
              commitChange((prev) => ({
                ...prev,
                groups: prev.groups.filter((g) => g.id !== gid),
              }))
            }
            onDeleteStickyNote={(nid) =>
              commitChange((prev) => ({
                ...prev,
                stickyNotes: prev.stickyNotes.filter((s) => s.id !== nid),
              }))
            }
          />

          {/* 3D Main Preview Viewport (Floating Dock on Desktop, PiP Card on Mobile) */}
          <MainPreview3D
            project={project}
            isMobile={isMobile}
            pipMinimized={pipMinimized}
            onTogglePipMinimize={() => setPipMinimized((m) => !m)}
          />
        </div>
      </main>

      {/* =========================================
          MOBILE BOTTOM NAVIGATION & BOTTOM SHEETS
         ========================================= */}
      {isMobile && (
        <>
          {mobileSheet !== 'none' && (
            <div
              className="sg-mobile-sheet-backdrop"
              onClick={() => setMobileSheet('none')}
            >
              <div
                className="sg-mobile-sheet"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sg-mobile-sheet-handle" />
                {(mobileSheet === 'blackboard' || mobileSheet === 'inspector') && (
                  <SidePanels
                    project={project}
                    selectedNode={selectedNode}
                    activeTab={mobileSheet}
                    onTabChange={(t) => setMobileSheet(t)}
                    onAddProperty={handleAddProperty}
                    onUpdateProperty={handleUpdateProperty}
                    onRemoveProperty={handleRemoveProperty}
                    onInsertPropertyNode={handleInsertPropertyNode}
                    onUpdateGraphSettings={handleUpdateGraphSettings}
                    onUpdateNodeInput={handleUpdateNodeInput}
                    onUpdateNodeSetting={handleUpdateNodeSetting}
                  />
                )}

                {mobileSheet === 'templates' && (
                  <div className="sg-mobile-templates-sheet">
                    <h3>Templates & Project Files</h3>
                    <div className="sg-mobile-template-actions">
                      <button
                        type="button"
                        className="sg-topbar-btn"
                        onClick={handleNewBlankGraph}
                      >
                        <FilePlus2 size={14} /> New Blank Graph
                      </button>
                      <button
                        type="button"
                        className="sg-topbar-btn"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} /> Import .shadergraph
                      </button>
                      <button
                        type="button"
                        className="sg-topbar-btn"
                        onClick={handleSaveToBrowserList}
                      >
                        <Check size={14} /> Save Snapshot
                      </button>
                    </div>
                    <div className="sg-mobile-tpl-list">
                      {STARTER_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          className="sg-dropdown-item"
                          onClick={() => {
                            commitChange(() => cloneProject(tpl));
                            setMobileSheet('none');
                          }}
                        >
                          <Sparkles size={15} />
                          <div>
                            <div className="sg-dd-title">{tpl.name}</div>
                            <div className="sg-dd-sub">{tpl.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <nav className="sg-mobile-navbar">
            <button
              type="button"
              className="sg-mob-nav-btn"
              onClick={() => {
                setAddNodeSpawnPos({ x: 260, y: 200 });
                setPendingConnectPort(undefined);
                setAddNodeOpen(true);
              }}
            >
              <Plus size={18} />
              <span>Add Node</span>
            </button>
            <button
              type="button"
              className={`sg-mob-nav-btn ${
                mobileSheet === 'blackboard' ? 'active' : ''
              }`}
              onClick={() =>
                setMobileSheet((s) =>
                  s === 'blackboard' ? 'none' : 'blackboard'
                )
              }
            >
              <Sliders size={17} />
              <span>Blackboard</span>
            </button>
            <button
              type="button"
              className={`sg-mob-nav-btn ${
                mobileSheet === 'inspector' ? 'active' : ''
              }`}
              onClick={() =>
                setMobileSheet((s) =>
                  s === 'inspector' ? 'none' : 'inspector'
                )
              }
            >
              <Settings size={17} />
              <span>Inspector</span>
            </button>
            <button
              type="button"
              className={`sg-mob-nav-btn ${
                mobileSheet === 'templates' ? 'active' : ''
              }`}
              onClick={() =>
                setMobileSheet((s) =>
                  s === 'templates' ? 'none' : 'templates'
                )
              }
            >
              <FolderOpen size={17} />
              <span>Templates</span>
            </button>
            <button
              type="button"
              className="sg-mob-nav-btn sg-mob-export-btn"
              onClick={() => {
                setExportModalTab('shadergraph');
                setExportModalOpen(true);
              }}
            >
              <Download size={17} />
              <span>Export</span>
            </button>
          </nav>
        </>
      )}

      {/* =========================================
          MODALS (CREATE NODE, EXPORT/IMPORT, DIAGNOSTICS)
         ========================================= */}
      <AddNodeModal
        isOpen={addNodeOpen}
        onClose={() => {
          setAddNodeOpen(false);
          setPendingConnectPort(undefined);
        }}
        properties={project.properties}
        pendingPort={pendingConnectPort}
        onAddNode={handleAddNode}
        onAddGroup={handleAddGroup}
        onAddStickyNote={handleAddStickyNote}
      />

      <ExportModal
        isOpen={exportModalOpen}
        initialTab={exportModalTab}
        onClose={() => setExportModalOpen(false)}
        project={project}
        onImportProject={(imported) => commitChange(() => imported)}
      />

      <DiagnosticsModal
        isOpen={diagnosticsModalOpen}
        onClose={() => setDiagnosticsModalOpen(false)}
        project={project}
        onResetToDefaultTemplate={() => {
          try {
            localStorage.removeItem(STORAGE_KEY_ACTIVE);
            localStorage.removeItem('unity_shadergraph_web_active_v1');
          } catch {
            // ignore
          }
          setProject(cloneProject(STARTER_TEMPLATES[0]));
        }}
      />
    </div>
  );
}

export default App;
