import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShaderGraphProject,
  GraphNode,
  ResolvedPortType,
  PortDefinition,
} from '../types/shadergraph';
import { getNodeDefinition } from '../nodes/nodeRegistry';
import { PortResolutionMap } from '../compiler/shaderCompiler';
import { NodeInlinePreview } from './NodeInlinePreview';
import { getAllTextureEntries, registerUploadedTexture } from '../utils/textureManager';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize,
  Upload,
  Unlink,
  Sparkles,
} from 'lucide-react';

export const PORT_COLORS: Record<ResolvedPortType, string> = {
  '1': '#38bdf8',         // Cyan (Float / Vector1)
  '2': '#4ade80',         // Green (Vector2)
  '3': '#facc15',         // Yellow (Vector3)
  '4': '#f472b6',         // Pink/Magenta (Vector4)
  color: '#fbbf24',       // Amber Gold (Color)
  texture2d: '#f87171',   // Red (Texture2D)
  sampler: '#cbd5e1',     // Slate (SamplerState)
  boolean: '#60a5fa',     // Blue (Boolean)
};

export function getPortColor(type: ResolvedPortType): string {
  return PORT_COLORS[type] || '#38bdf8';
}

export function formatDimBadge(type: ResolvedPortType): string {
  switch (type) {
    case '1':
      return '1';
    case '2':
      return '2';
    case '3':
      return '3';
    case '4':
      return '4';
    case 'color':
      return 'C';
    case 'texture2d':
      return 'T2';
    case 'boolean':
      return 'B';
    default:
      return '1';
  }
}

export interface PendingConnection {
  nodeId: string;
  portId: string;
  direction: 'input' | 'output';
  portType: ResolvedPortType;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isTapMode?: boolean;
}

interface GraphCanvasProps {
  project: ShaderGraphProject;
  portResolutions: PortResolutionMap;
  selectedNodeIds: string[];
  onSelectNodes: (ids: string[]) => void;
  onUpdateNodePosition: (nodeId: string, x: number, y: number) => void;
  onUpdateNodeInput: (nodeId: string, portId: string, value: any) => void;
  onUpdateNodeSetting: (nodeId: string, key: string, value: any) => void;
  onToggleNodePreview: (nodeId: string) => void;
  onConnectPorts: (
    sourceNodeId: string,
    sourcePortId: string,
    targetNodeId: string,
    targetPortId: string
  ) => void;
  onRemoveEdge: (edgeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onOpenAddNodeAt: (
    canvasPos: { x: number; y: number },
    pendingPort?: {
      nodeId: string;
      portId: string;
      direction: 'input' | 'output';
      portType: ResolvedPortType;
    }
  ) => void;
  onUpdateGroupPosition: (
    groupId: string,
    x: number,
    y: number,
    childNodePositions?: Array<{ id: string; x: number; y: number }>,
    childNotePositions?: Array<{ id: string; x: number; y: number }>
  ) => void;
  onUpdateStickyNote: (
    noteId: string,
    patch: Partial<{ title: string; content: string; x: number; y: number }>
  ) => void;
  onDeleteGroup: (groupId: string) => void;
  onDeleteStickyNote: (noteId: string) => void;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  project,
  portResolutions,
  selectedNodeIds,
  onSelectNodes,
  onUpdateNodePosition,
  onUpdateNodeInput,
  onUpdateNodeSetting,
  onToggleNodePreview,
  onConnectPorts,
  onRemoveEdge,
  onDeleteNode,
  onDuplicateNode,
  onOpenAddNodeAt,
  onUpdateGroupPosition,
  onUpdateStickyNote,
  onDeleteGroup,
  onDeleteStickyNote,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);

  const [viewport, setViewport] = useState({ x: 40, y: 30, zoom: 0.85 });
  const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null);
  const [portPositions, setPortPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Refs for gesture state
  const dragStateRef = useRef<{
    mode: 'none' | 'pan' | 'node' | 'group' | 'note' | 'wire' | 'pinch';
    targetId?: string;
    startClientX: number;
    startClientY: number;
    initialX: number;
    initialY: number;
    groupChildNodes?: Array<{ id: string; initialX: number; initialY: number }>;
    groupChildNotes?: Array<{ id: string; initialX: number; initialY: number }>;
    pinchInitialDist?: number;
    pinchInitialZoom?: number;
    pinchCenterX?: number;
    pinchCenterY?: number;
  }>({
    mode: 'none',
    startClientX: 0,
    startClientY: 0,
    initialX: 0,
    initialY: 0,
  });

  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Measure port DOM positions in canvas coordinates
  const measureAllPorts = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const els = container.querySelectorAll<HTMLElement>('[data-port-key]');
    const next: Record<string, { x: number; y: number }> = {};
    els.forEach((el) => {
      const key = el.getAttribute('data-port-key');
      if (!key) return;
      const r = el.getBoundingClientRect();
      const cx = (r.left + r.width / 2 - cRect.left - viewport.x) / viewport.zoom;
      const cy = (r.top + r.height / 2 - cRect.top - viewport.y) / viewport.zoom;
      next[key] = { x: cx, y: cy };
    });
    setPortPositions(next);
  }, [viewport]);

  useEffect(() => {
    const id = requestAnimationFrame(measureAllPorts);
    return () => cancelAnimationFrame(id);
  }, [project.nodes, project.edges, viewport, measureAllPorts]);

  // Fit graph into view
  const handleFitView = useCallback(() => {
    const container = containerRef.current;
    if (!container || project.nodes.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of project.nodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + 240);
      maxY = Math.max(maxY, n.position.y + 280);
    }
    const graphW = Math.max(400, maxX - minX + 120);
    const graphH = Math.max(300, maxY - minY + 120);
    const cw = container.clientWidth || 900;
    const ch = container.clientHeight || 600;
    const zoom = Math.max(0.32, Math.min(1.15, Math.min(cw / graphW, ch / graphH) * 0.9));
    const x = (cw - (maxX - minX) * zoom) / 2 - minX * zoom;
    const y = (ch - (maxY - minY) * zoom) / 2 - minY * zoom;
    setViewport({ x, y, zoom });
  }, [project.nodes]);

  // Spacebar shortcut to open Add Node menu
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const center = screenToCanvas(
          rect.left + rect.width * 0.45,
          rect.top + rect.height * 0.45
        );
        onOpenAddNodeAt(center);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIds.length > 0) {
        for (const id of selectedNodeIds) {
          onDeleteNode(id);
        }
      } else if (e.key === 'Escape' && pendingConn) {
        setPendingConn(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screenToCanvas, onOpenAddNodeAt, selectedNodeIds, onDeleteNode, pendingConn]);

  // Canvas background pointer down (pan or two-finger pinch)
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      dragStateRef.current = {
        mode: 'pinch',
        startClientX: cx,
        startClientY: cy,
        initialX: viewport.x,
        initialY: viewport.y,
        pinchInitialDist: Math.max(20, dist),
        pinchInitialZoom: viewport.zoom,
      };
      return;
    }

    if (e.target === containerRef.current || e.target === worldRef.current || (e.target as HTMLElement).classList.contains('sg-edges-svg')) {
      if (pendingConn?.isTapMode) {
        setPendingConn(null);
      }
      onSelectNodes([]);
      dragStateRef.current = {
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        initialX: viewport.x,
        initialY: viewport.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const state = dragStateRef.current;

    if (state.mode === 'pinch' && activePointersRef.current.size >= 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const scaleRatio = dist / (state.pinchInitialDist || 100);
      const nextZoom = Math.max(0.25, Math.min(2.0, (state.pinchInitialZoom || 1) * scaleRatio));
      const dx = cx - state.startClientX;
      const dy = cy - state.startClientY;
      setViewport({
        x: state.initialX + dx,
        y: state.initialY + dy,
        zoom: nextZoom,
      });
      return;
    }

    if (state.mode === 'pan') {
      const dx = e.clientX - state.startClientX;
      const dy = e.clientY - state.startClientY;
      setViewport((v) => ({
        ...v,
        x: state.initialX + dx,
        y: state.initialY + dy,
      }));
      return;
    }

    if (state.mode === 'node' && state.targetId) {
      const dx = (e.clientX - state.startClientX) / viewport.zoom;
      const dy = (e.clientY - state.startClientY) / viewport.zoom;
      onUpdateNodePosition(
        state.targetId,
        Math.round(state.initialX + dx),
        Math.round(state.initialY + dy)
      );
      return;
    }

    if (state.mode === 'group' && state.targetId) {
      const dx = (e.clientX - state.startClientX) / viewport.zoom;
      const dy = (e.clientY - state.startClientY) / viewport.zoom;
      const childNodes = (state.groupChildNodes || []).map((cn) => ({
        id: cn.id,
        x: Math.round(cn.initialX + dx),
        y: Math.round(cn.initialY + dy),
      }));
      const childNotes = (state.groupChildNotes || []).map((cs) => ({
        id: cs.id,
        x: Math.round(cs.initialX + dx),
        y: Math.round(cs.initialY + dy),
      }));
      onUpdateGroupPosition(
        state.targetId,
        Math.round(state.initialX + dx),
        Math.round(state.initialY + dy),
        childNodes,
        childNotes
      );
      return;
    }

    if (state.mode === 'note' && state.targetId) {
      const dx = (e.clientX - state.startClientX) / viewport.zoom;
      const dy = (e.clientY - state.startClientY) / viewport.zoom;
      onUpdateStickyNote(state.targetId, {
        x: Math.round(state.initialX + dx),
        y: Math.round(state.initialY + dy),
      });
      return;
    }

    if (state.mode === 'wire' && pendingConn) {
      const pt = screenToCanvas(e.clientX, e.clientY);
      setPendingConn((prev) =>
        prev ? { ...prev, currentX: pt.x, currentY: pt.y } : null
      );
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    const state = dragStateRef.current;

    if (state.mode === 'wire' && pendingConn) {
      const distMoved = Math.hypot(
        e.clientX - state.startClientX,
        e.clientY - state.startClientY
      );

      // Check if pointer was released over a compatible port element
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const portEl = elUnder?.closest?.('[data-port-key]') as HTMLElement | null;

      if (portEl) {
        const targetNodeId = portEl.getAttribute('data-node-id')!;
        const targetPortId = portEl.getAttribute('data-port-id')!;
        const targetDir = portEl.getAttribute('data-port-dir') as 'input' | 'output';

        if (targetNodeId !== pendingConn.nodeId && targetDir !== pendingConn.direction) {
          if (pendingConn.direction === 'output') {
            onConnectPorts(
              pendingConn.nodeId,
              pendingConn.portId,
              targetNodeId,
              targetPortId
            );
          } else {
            onConnectPorts(
              targetNodeId,
              targetPortId,
              pendingConn.nodeId,
              pendingConn.portId
            );
          }
          setPendingConn(null);
          dragStateRef.current.mode = 'none';
          return;
        }
      }

      // If user barely moved the finger/mouse (< 8px), enter Tap-to-Connect mode!
      if (distMoved < 8) {
        setPendingConn((prev) => (prev ? { ...prev, isTapMode: true } : null));
      } else {
        // User dragged a wire into empty canvas space -> open Create Node menu at drop point!
        const dropPos = screenToCanvas(e.clientX, e.clientY);
        onOpenAddNodeAt(dropPos, {
          nodeId: pendingConn.nodeId,
          portId: pendingConn.portId,
          direction: pendingConn.direction,
          portType: pendingConn.portType,
        });
        setPendingConn(null);
      }
    }

    dragStateRef.current.mode = 'none';
  };

  // Mouse wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY < 0 ? 1.09 : 0.91;
    const nextZoom = Math.max(0.25, Math.min(2.0, viewport.zoom * factor));
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const nextX = mouseX - ((mouseX - viewport.x) / viewport.zoom) * nextZoom;
    const nextY = mouseY - ((mouseY - viewport.y) / viewport.zoom) * nextZoom;
    setViewport({ x: nextX, y: nextY, zoom: nextZoom });
  };

  // Start dragging a node header
  const handleNodeHeaderPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    node: GraphNode
  ) => {
    e.stopPropagation();
    onSelectNodes([node.id]);
    dragStateRef.current = {
      mode: 'node',
      targetId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialX: node.position.x,
      initialY: node.position.y,
    };
  };

  // Start dragging or tapping a port
  const handlePortPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    node: GraphNode,
    port: PortDefinition,
    resolvedType: ResolvedPortType
  ) => {
    e.stopPropagation();

    // If already in Tap-to-Connect mode, complete connection on tap!
    if (pendingConn) {
      if (
        pendingConn.nodeId !== node.id &&
        pendingConn.direction !== port.direction
      ) {
        if (pendingConn.direction === 'output') {
          onConnectPorts(pendingConn.nodeId, pendingConn.portId, node.id, port.id);
        } else {
          onConnectPorts(node.id, port.id, pendingConn.nodeId, pendingConn.portId);
        }
        setPendingConn(null);
        return;
      }
      if (pendingConn.nodeId === node.id && pendingConn.portId === port.id) {
        setPendingConn(null);
        return;
      }
    }

    const key = `${node.id}:${port.direction}:${port.id}`;
    const pos = portPositions[key] || screenToCanvas(e.clientX, e.clientY);

    setPendingConn({
      nodeId: node.id,
      portId: port.id,
      direction: port.direction,
      portType: resolvedType,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      isTapMode: false,
    });

    dragStateRef.current = {
      mode: 'wire',
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialX: pos.x,
      initialY: pos.y,
    };
  };

  const textureList = useMemo(() => getAllTextureEntries(), [project]);

  const computeBezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.max(55, Math.abs(x2 - x1) * 0.48);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div
      ref={containerRef}
      id="shadergraph-canvas"
      className="sg-canvas-container"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onWheel={handleWheel}
      onDoubleClick={(e) => {
        if (e.target === containerRef.current || e.target === worldRef.current) {
          onOpenAddNodeAt(screenToCanvas(e.clientX, e.clientY));
        }
      }}
    >
      {/* Tap-to-Connect Active Floating Assist Banner (Great for Mobile & Desktop!) */}
      {pendingConn?.isTapMode && (
        <div className="sg-tap-connect-banner">
          <span
            className="sg-tap-dot"
            style={{ backgroundColor: getPortColor(pendingConn.portType) }}
          />
          <span>
            Wiring <strong>{pendingConn.portId.toUpperCase()}</strong> — Tap any{' '}
            {pendingConn.direction === 'output' ? 'Input' : 'Output'} port to connect
          </span>
          <button
            type="button"
            className="sg-tap-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAddNodeAt(
                {
                  x:
                    pendingConn.startX +
                    (pendingConn.direction === 'output' ? 230 : -230),
                  y: pendingConn.startY - 30,
                },
                {
                  nodeId: pendingConn.nodeId,
                  portId: pendingConn.portId,
                  direction: pendingConn.direction,
                  portType: pendingConn.portType,
                }
              );
              setPendingConn(null);
            }}
          >
            <Plus size={13} /> Wire New Node
          </button>
          <button
            type="button"
            className="sg-tap-cancel-btn"
            onClick={(e) => {
              e.stopPropagation();
              setPendingConn(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Transformable World Layer */}
      <div
        ref={worldRef}
        className="sg-canvas-world"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {/* 1. Group Frames */}
        {project.groups.map((grp) => (
          <div
            key={grp.id}
            className="sg-group-frame"
            style={{
              left: grp.position.x,
              top: grp.position.y,
              width: grp.size.width,
              height: grp.size.height,
              borderColor: `${grp.color}55`,
            }}
          >
            <div
              className="sg-group-header"
              style={{ backgroundColor: `${grp.color}22`, borderBottomColor: `${grp.color}44` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const gx1 = grp.position.x;
                const gy1 = grp.position.y;
                const gx2 = gx1 + grp.size.width;
                const gy2 = gy1 + grp.size.height;

                const groupChildNodes = project.nodes
                  .filter((n) => {
                    const cx = n.position.x + 90;
                    const cy = n.position.y + 40;
                    return cx >= gx1 && cx <= gx2 && cy >= gy1 && cy <= gy2;
                  })
                  .map((n) => ({
                    id: n.id,
                    initialX: n.position.x,
                    initialY: n.position.y,
                  }));

                const groupChildNotes = project.stickyNotes
                  .filter((s) => {
                    const cx = s.position.x + s.size.width / 2;
                    const cy = s.position.y + s.size.height / 2;
                    return cx >= gx1 && cx <= gx2 && cy >= gy1 && cy <= gy2;
                  })
                  .map((s) => ({
                    id: s.id,
                    initialX: s.position.x,
                    initialY: s.position.y,
                  }));

                dragStateRef.current = {
                  mode: 'group',
                  targetId: grp.id,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  initialX: grp.position.x,
                  initialY: grp.position.y,
                  groupChildNodes,
                  groupChildNotes,
                };
              }}
            >
              <span className="sg-group-title">{grp.title}</span>
              <button
                type="button"
                className="sg-node-mini-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteGroup(grp.id);
                }}
                title="Remove Group Frame"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {/* 2. Sticky Notes */}
        {project.stickyNotes.map((note) => (
          <div
            key={note.id}
            className={`sg-sticky-note sg-sticky-${note.theme}`}
            style={{
              left: note.position.x,
              top: note.position.y,
              width: note.size.width,
              minHeight: note.size.height,
            }}
          >
            <div
              className="sg-sticky-header"
              onPointerDown={(e) => {
                e.stopPropagation();
                dragStateRef.current = {
                  mode: 'note',
                  targetId: note.id,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  initialX: note.position.x,
                  initialY: note.position.y,
                };
              }}
            >
              <input
                type="text"
                className="sg-sticky-title-input"
                value={note.title}
                onChange={(e) => onUpdateStickyNote(note.id, { title: e.target.value })}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className="sg-node-mini-btn"
                onClick={() => onDeleteStickyNote(note.id)}
                title="Delete Sticky Note"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <textarea
              className="sg-sticky-body"
              value={note.content}
              onChange={(e) => onUpdateStickyNote(note.id, { content: e.target.value })}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        ))}

        {/* 3. SVG Edges Layer */}
        <svg className="sg-edges-svg" width={4000} height={4000}>
          <defs>
            {project.edges.map((edge) => {
              const srcRes =
                portResolutions[edge.sourceNodeId]?.outputs[edge.sourcePortId] || '1';
              const tgtRes =
                portResolutions[edge.targetNodeId]?.inputs[edge.targetPortId] || srcRes;
              const c1 = getPortColor(srcRes);
              const c2 = getPortColor(tgtRes);
              return (
                <linearGradient
                  key={`grad_${edge.id}`}
                  id={`grad_${edge.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor={c1} />
                  <stop offset="100%" stopColor={c2} />
                </linearGradient>
              );
            })}
          </defs>

          {project.edges.map((edge) => {
            const p1 = portPositions[`${edge.sourceNodeId}:output:${edge.sourcePortId}`];
            const p2 = portPositions[`${edge.targetNodeId}:input:${edge.targetPortId}`];
            if (!p1 || !p2) return null;
            const d = computeBezierPath(p1.x, p1.y, p2.x, p2.y);
            const isHovered = hoveredEdgeId === edge.id;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            return (
              <g
                key={edge.id}
                className="sg-edge-group"
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseLeave={() => setHoveredEdgeId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveEdge(edge.id);
                }}
              >
                {/* Wide invisible hit target for easy touch & mouse clicking */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20}
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                />
                {/* Outer subtle casing */}
                <path
                  d={d}
                  fill="none"
                  stroke="rgba(8, 11, 18, 0.85)"
                  strokeWidth={isHovered ? 6 : 4.5}
                />
                {/* Gradient wire */}
                <path
                  d={d}
                  fill="none"
                  stroke={`url(#grad_${edge.id})`}
                  strokeWidth={isHovered ? 3.6 : 2.5}
                  strokeLinecap="round"
                />
                {isHovered && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <circle r={10} fill="#ef4444" />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      ×
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Active Dragging Wire */}
          {pendingConn && !pendingConn.isTapMode && (
            <path
              d={
                pendingConn.direction === 'output'
                  ? computeBezierPath(
                      pendingConn.startX,
                      pendingConn.startY,
                      pendingConn.currentX,
                      pendingConn.currentY
                    )
                  : computeBezierPath(
                      pendingConn.currentX,
                      pendingConn.currentY,
                      pendingConn.startX,
                      pendingConn.startY
                    )
              }
              fill="none"
              stroke={getPortColor(pendingConn.portType)}
              strokeWidth={2.8}
              strokeDasharray="6 4"
            />
          )}
        </svg>

        {/* 4. Graph Nodes */}
        {project.nodes.map((node) => {
          const def = getNodeDefinition(node, project.properties);
          const isSelected = selectedNodeIds.includes(node.id);
          const res = portResolutions[node.id];

          const visibleInputs =
            def.isMaster && project.settings.subTarget === 'Unlit'
              ? def.inputs.filter((inp) =>
                  [
                    'vertexPosition',
                    'vertexNormal',
                    'vertexTangent',
                    'baseColor',
                    'alpha',
                    'alphaClipThreshold',
                  ].includes(inp.id)
                )
              : def.inputs;

          return (
            <div
              key={node.id}
              data-node-card={node.id}
              className={`sg-node-card sg-cat-${def.category.toLowerCase()} ${
                def.isMaster ? 'sg-node-master' : ''
              } ${node.typeId === 'property' ? 'sg-node-property-pill' : ''} ${
                isSelected ? 'selected' : ''
              }`}
              style={{
                left: node.position.x,
                top: node.position.y,
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelectNodes([node.id]);
              }}
            >
              {/* Node Header */}
              <div
                className="sg-node-header"
                onPointerDown={(e) => handleNodeHeaderPointerDown(e, node)}
              >
                <div className="sg-node-title-wrap">
                  <span className="sg-node-category-dot" />
                  <span className="sg-node-title">
                    {def.isMaster
                      ? `URP ${project.settings.subTarget} Master`
                      : def.title}
                  </span>
                </div>

                <div className="sg-node-header-btns">
                  {def.hasPreview && (
                    <button
                      type="button"
                      className="sg-node-mini-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleNodePreview(node.id);
                      }}
                      title={node.previewExpanded ? 'Collapse 2D Preview' : 'Expand 2D Preview'}
                    >
                      {node.previewExpanded ? (
                        <ChevronUp size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                    </button>
                  )}
                  {!def.isMaster && (
                    <>
                      <button
                        type="button"
                        className="sg-node-mini-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateNode(node.id);
                        }}
                        title="Duplicate Node"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        className="sg-node-mini-btn sg-node-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNode(node.id);
                        }}
                        title="Delete Node"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Node Ports Body */}
              <div className="sg-node-body">
                {/* Input Ports Column */}
                {visibleInputs.length > 0 && (
                  <div className="sg-ports-col sg-ports-inputs">
                    {visibleInputs.map((input) => {
                      const resolvedType: ResolvedPortType =
                        res?.inputs[input.id] ||
                        (input.type === 'dynamic' ? '1' : input.type);
                      const portColor = getPortColor(resolvedType);
                      const connectedEdge = project.edges.find(
                        (e) =>
                          e.targetNodeId === node.id && e.targetPortId === input.id
                      );
                      const isPendingTarget =
                        pendingConn &&
                        pendingConn.nodeId !== node.id &&
                        pendingConn.direction === 'output';

                      const rawVal =
                        node.inputValues?.[input.id] !== undefined
                          ? node.inputValues[input.id]
                          : input.defaultValue;

                      return (
                        <div key={input.id} className="sg-port-row sg-port-input-row">
                          <div className="sg-port-left">
                            <button
                              type="button"
                              data-port-key={`${node.id}:input:${input.id}`}
                              data-node-id={node.id}
                              data-port-id={input.id}
                              data-port-dir="input"
                              className={`sg-port-socket ${
                                connectedEdge ? 'connected' : ''
                              } ${isPendingTarget ? 'compatible-pulse' : ''}`}
                              style={{
                                borderColor: portColor,
                                backgroundColor: connectedEdge ? portColor : 'transparent',
                              }}
                              onPointerDown={(e) =>
                                handlePortPointerDown(e, node, input, resolvedType)
                              }
                              title={`${input.name} (${formatDimBadge(
                                resolvedType
                              )}) — Drag or Tap to connect`}
                            />
                            <span className="sg-port-label">
                              {input.name}
                              <span
                                className="sg-port-dim"
                                style={{ color: portColor }}
                              >
                                ({formatDimBadge(resolvedType)})
                              </span>
                            </span>
                            {connectedEdge && (
                              <button
                                type="button"
                                className="sg-port-unlink-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveEdge(connectedEdge.id);
                                }}
                                title="Disconnect wire"
                              >
                                <Unlink size={10} />
                              </button>
                            )}
                          </div>

                          {/* Inline Constant Value Control when unconnected */}
                          {!connectedEdge && (
                            <div
                              className="sg-port-inline-editor"
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              {input.binding && input.binding !== 'none' ? (
                                <span className="sg-binding-pill">{input.binding}</span>
                              ) : resolvedType === 'color' ? (
                                <input
                                  type="color"
                                  className="sg-inline-color"
                                  value={typeof rawVal === 'string' ? rawVal : '#4ca6ff'}
                                  onChange={(e) =>
                                    onUpdateNodeInput(node.id, input.id, e.target.value)
                                  }
                                />
                              ) : resolvedType === 'boolean' ? (
                                <input
                                  type="checkbox"
                                  checked={Boolean(rawVal)}
                                  onChange={(e) =>
                                    onUpdateNodeInput(node.id, input.id, e.target.checked)
                                  }
                                />
                              ) : resolvedType === '2' && Array.isArray(rawVal) ? (
                                <div className="sg-inline-vec">
                                  {[0, 1].map((idx) => (
                                    <input
                                      key={idx}
                                      type="number"
                                      step="0.1"
                                      className="sg-inline-num sg-inline-num-sm"
                                      value={rawVal[idx] ?? 0}
                                      onChange={(e) => {
                                        const next = [...rawVal];
                                        next[idx] = parseFloat(e.target.value) || 0;
                                        onUpdateNodeInput(node.id, input.id, next);
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : resolvedType === '3' && Array.isArray(rawVal) ? (
                                <div className="sg-inline-vec">
                                  {[0, 1, 2].map((idx) => (
                                    <input
                                      key={idx}
                                      type="number"
                                      step="0.1"
                                      className="sg-inline-num sg-inline-num-xs"
                                      value={rawVal[idx] ?? 0}
                                      onChange={(e) => {
                                        const next = [...rawVal];
                                        next[idx] = parseFloat(e.target.value) || 0;
                                        onUpdateNodeInput(node.id, input.id, next);
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : resolvedType !== 'texture2d' ? (
                                <input
                                  type="number"
                                  step="0.05"
                                  className="sg-inline-num"
                                  value={
                                    typeof rawVal === 'number'
                                      ? rawVal
                                      : Array.isArray(rawVal)
                                      ? rawVal[0] ?? 0
                                      : 0
                                  }
                                  onChange={(e) =>
                                    onUpdateNodeInput(
                                      node.id,
                                      input.id,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                />
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Output Ports Column */}
                {def.outputs.length > 0 && (
                  <div className="sg-ports-col sg-ports-outputs">
                    {def.outputs.map((output) => {
                      const resolvedType: ResolvedPortType =
                        res?.outputs[output.id] ||
                        (output.type === 'dynamic' ? '1' : output.type);
                      const portColor = getPortColor(resolvedType);
                      const isConnected = project.edges.some(
                        (e) =>
                          e.sourceNodeId === node.id && e.sourcePortId === output.id
                      );
                      const isPendingSource =
                        pendingConn?.nodeId === node.id &&
                        pendingConn?.portId === output.id;
                      const isPendingTarget =
                        pendingConn &&
                        pendingConn.nodeId !== node.id &&
                        pendingConn.direction === 'input';

                      return (
                        <div key={output.id} className="sg-port-row sg-port-output-row">
                          <span className="sg-port-label">
                            {output.name}
                            <span
                              className="sg-port-dim"
                              style={{ color: portColor }}
                            >
                              ({formatDimBadge(resolvedType)})
                            </span>
                          </span>
                          <button
                            type="button"
                            data-port-key={`${node.id}:output:${output.id}`}
                            data-node-id={node.id}
                            data-port-id={output.id}
                            data-port-dir="output"
                            className={`sg-port-socket ${
                              isConnected || isPendingSource ? 'connected' : ''
                            } ${isPendingTarget ? 'compatible-pulse' : ''}`}
                            style={{
                              borderColor: portColor,
                              backgroundColor:
                                isConnected || isPendingSource
                                  ? portColor
                                  : 'transparent',
                            }}
                            onPointerDown={(e) =>
                              handlePortPointerDown(e, node, output, resolvedType)
                            }
                            title={`${output.name} (${formatDimBadge(
                              resolvedType
                            )}) — Drag or Tap to connect`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Node Specific Settings Controls */}
              {def.settings && def.settings.length > 0 && (
                <div
                  className="sg-node-settings"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {def.settings.map((st) => {
                    const val =
                      node.settings?.[st.key] !== undefined
                        ? node.settings[st.key]
                        : st.defaultValue;

                    if (st.type === 'select' && st.options) {
                      return (
                        <div key={st.key} className="sg-setting-row">
                          <label>{st.label}</label>
                          <select
                            value={val}
                            onChange={(e) =>
                              onUpdateNodeSetting(node.id, st.key, e.target.value)
                            }
                          >
                            {st.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (st.type === 'color') {
                      return (
                        <div key={st.key} className="sg-setting-row">
                          <label>{st.label}</label>
                          <input
                            type="color"
                            className="sg-inline-color"
                            value={val || '#00d2ff'}
                            onChange={(e) =>
                              onUpdateNodeSetting(node.id, st.key, e.target.value)
                            }
                          />
                        </div>
                      );
                    }

                    if (st.type === 'number') {
                      return (
                        <div key={st.key} className="sg-setting-row">
                          <label>{st.label}</label>
                          <input
                            type="number"
                            step="0.1"
                            className="sg-inline-num"
                            value={val ?? 0}
                            onChange={(e) =>
                              onUpdateNodeSetting(
                                node.id,
                                st.key,
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                      );
                    }

                    if (st.type === 'boolean') {
                      return (
                        <div key={st.key} className="sg-setting-row">
                          <label>{st.label}</label>
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) =>
                              onUpdateNodeSetting(node.id, st.key, e.target.checked)
                            }
                          />
                        </div>
                      );
                    }

                    if (st.type === 'swizzle') {
                      return (
                        <div key={st.key} className="sg-setting-row">
                          <label>{st.label}</label>
                          <input
                            type="text"
                            maxLength={4}
                            className="sg-inline-text"
                            value={val || 'zyxw'}
                            onChange={(e) =>
                              onUpdateNodeSetting(node.id, st.key, e.target.value)
                            }
                          />
                        </div>
                      );
                    }

                    if (st.type === 'texture') {
                      return (
                        <div key={st.key} className="sg-setting-col">
                          <div className="sg-setting-row">
                            <label>{st.label}</label>
                            <select
                              value={val || 'uvgrid'}
                              onChange={(e) =>
                                onUpdateNodeSetting(node.id, st.key, e.target.value)
                              }
                            >
                              {textureList.map((t) => (
                                <option key={t.key} value={t.key}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <label className="sg-upload-tex-btn">
                            <Upload size={11} />
                            <span>Upload Image...</span>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const entry = await registerUploadedTexture(file);
                                  onUpdateNodeSetting(node.id, st.key, entry.key);
                                }
                              }}
                            />
                          </label>
                        </div>
                      );
                    }

                    if (st.type === 'textarea') {
                      return (
                        <div key={st.key} className="sg-setting-col">
                          <label>{st.label}</label>
                          <textarea
                            rows={2}
                            className="sg-inline-textarea"
                            value={val || ''}
                            onChange={(e) =>
                              onUpdateNodeSetting(node.id, st.key, e.target.value)
                            }
                          />
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}

              {/* Collapsible 2D Live Shader Preview */}
              {def.hasPreview && node.previewExpanded && (
                <NodeInlinePreview nodeId={node.id} project={project} />
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom-Left Canvas Navigation & Quick Actions HUD */}
      <div className="sg-canvas-hud" onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="sg-hud-btn sg-hud-primary"
          onClick={() => {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            onOpenAddNodeAt(
              screenToCanvas(rect.left + rect.width * 0.4, rect.top + rect.height * 0.4)
            );
          }}
          title="Add Node (Spacebar or Double-Tap)"
        >
          <Plus size={15} />
          <span>Add Node</span>
        </button>

        <div className="sg-hud-zoom-group">
          <button
            type="button"
            className="sg-hud-icon-btn"
            onClick={() =>
              setViewport((v) => ({ ...v, zoom: Math.max(0.25, v.zoom - 0.12) }))
            }
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="sg-hud-zoom-label">{Math.round(viewport.zoom * 100)}%</span>
          <button
            type="button"
            className="sg-hud-icon-btn"
            onClick={() =>
              setViewport((v) => ({ ...v, zoom: Math.min(2.0, v.zoom + 0.12) }))
            }
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="sg-hud-icon-btn"
            onClick={handleFitView}
            title="Frame All Nodes"
          >
            <Maximize size={14} />
          </button>
        </div>
      </div>

      {/* Subtle hint badge on desktop */}
      <div className="sg-canvas-hint">
        <Sparkles size={11} />
        <span>Space / Double-tap to Add Node · Drag or Tap ports to wire</span>
      </div>
    </div>
  );
};
