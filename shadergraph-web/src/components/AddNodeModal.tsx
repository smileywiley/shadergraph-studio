import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  NodeDefinition,
  NodeCategory,
  BlackboardProperty,
  ResolvedPortType,
} from '../types/shadergraph';
import { NODE_DEFINITIONS } from '../nodes/nodeRegistry';
import { Search, X, Sparkles, FolderPlus, StickyNote as StickyIcon, Sliders } from 'lucide-react';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: BlackboardProperty[];
  pendingPort?: {
    nodeId: string;
    portId: string;
    direction: 'input' | 'output';
    portType: ResolvedPortType;
  };
  onAddNode: (typeId: string, propertyId?: string) => void;
  onAddGroup: () => void;
  onAddStickyNote: () => void;
}

const CATEGORIES: ('All' | NodeCategory)[] = [
  'All',
  'Input',
  'Math',
  'Procedural',
  'UV',
  'Channel',
  'Artistic',
  'Utility',
];

export const AddNodeModal: React.FC<AddNodeModalProps> = ({
  isOpen,
  onClose,
  properties,
  pendingPort,
  onAddNode,
  onAddGroup,
  onAddStickyNote,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | NodeCategory>('All');
  const [hoveredDef, setHoveredDef] = useState<NodeDefinition | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const creatableDefs = useMemo(
    () =>
      NODE_DEFINITIONS.filter(
        (d) => !d.isMaster && d.typeId !== 'property' && d.typeId !== 'unknown-unity'
      ),
    []
  );

  const filteredDefs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return creatableDefs.filter((def) => {
      if (activeCategory !== 'All' && def.category !== activeCategory) return false;
      if (!q) return true;
      const inTitle = def.title.toLowerCase().includes(q);
      const inCat = def.category.toLowerCase().includes(q);
      const inDesc = def.description.toLowerCase().includes(q);
      const inSyn = def.synonyms?.some((s) => s.toLowerCase().includes(q));
      return inTitle || inCat || inDesc || inSyn;
    });
  }, [creatableDefs, activeCategory, query]);

  if (!isOpen) return null;

  return (
    <div className="sg-modal-backdrop" onClick={onClose}>
      <div
        className="sg-addnode-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sg-addnode-header">
          <div className="sg-addnode-title">
            <Sparkles size={15} />
            <span>
              {pendingPort
                ? `Connect ${pendingPort.direction === 'output' ? 'Output' : 'Input'} Port (${pendingPort.portId.toUpperCase()})`
                : 'Create Node'}
            </span>
          </div>
          <button type="button" className="sg-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Search Input */}
        <div className="sg-search-box">
          <Search size={15} className="sg-search-icon" />
          <input
            ref={inputRef}
            id="create-node-search-input"
            type="text"
            placeholder="Search Unity Shader Graph nodes (e.g. Lerp, Fresnel, Voronoi, Multiply, Sample Texture)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredDefs.length > 0) {
                onAddNode(filteredDefs[0].typeId);
                onClose();
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
        </div>

        {/* Category Filter Pills */}
        <div className="sg-cat-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`sg-cat-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Quick Organization Actions & Blackboard Properties */}
        {activeCategory === 'All' && !query && (
          <div className="sg-quick-insert-bar">
            <button
              type="button"
              className="sg-quick-chip"
              onClick={() => {
                onAddGroup();
                onClose();
              }}
            >
              <FolderPlus size={13} />
              <span>Group Selection / Frame</span>
            </button>
            <button
              type="button"
              className="sg-quick-chip"
              onClick={() => {
                onAddStickyNote();
                onClose();
              }}
            >
              <StickyIcon size={13} />
              <span>Sticky Note</span>
            </button>

            {properties.map((prop) => (
              <button
                key={prop.id}
                type="button"
                className="sg-quick-chip sg-prop-chip"
                onClick={() => {
                  onAddNode('property', prop.id);
                  onClose();
                }}
              >
                <Sliders size={12} />
                <span>{prop.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Node List */}
        <div className="sg-addnode-list">
          {filteredDefs.map((def) => (
            <button
              key={def.typeId}
              type="button"
              className="sg-addnode-item"
              onMouseEnter={() => setHoveredDef(def)}
              onClick={() => {
                onAddNode(def.typeId);
                onClose();
              }}
            >
              <div className="sg-addnode-item-left">
                <span
                  className={`sg-cat-badge sg-cat-${def.category.toLowerCase()}`}
                >
                  {def.category}
                </span>
                <span className="sg-addnode-item-title">{def.title}</span>
              </div>
              <span className="sg-addnode-item-unity">
                {def.unityType.replace('UnityEditor.ShaderGraph.', '')}
              </span>
            </button>
          ))}

          {filteredDefs.length === 0 && (
            <div className="sg-empty-state">
              No nodes match "{query}". Try searching by category or math symbol.
            </div>
          )}
        </div>

        {/* Footer Description */}
        <div className="sg-addnode-footer">
          {hoveredDef ? (
            <>
              <strong>{hoveredDef.title}:</strong> {hoveredDef.description}
            </>
          ) : (
            <span>
              Tip: Press <kbd>Enter</kbd> to insert top match, or drag any port into empty space.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
