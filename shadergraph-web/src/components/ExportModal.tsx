import React, { useState, useMemo } from 'react';
import { ShaderGraphProject } from '../types/shadergraph';
import {
  exportToUnityShaderGraph,
  importShaderGraphFile,
} from '../compiler/unityShaderGraphIO';
import {
  compileToUnityShaderLab,
  compileToWebGL,
} from '../compiler/shaderCompiler';
import {
  Download,
  Upload,
  Copy,
  Check,
  Code2,
  FileCode,
  Share2,
  X,
  FileJson,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  initialTab?: 'shadergraph' | 'shaderlab' | 'glsl' | 'import';
  onClose: () => void;
  project: ShaderGraphProject;
  onImportProject: (proj: ShaderGraphProject) => void;
}

export function triggerFileDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  initialTab = 'shadergraph',
  onClose,
  project,
  onImportProject,
}) => {
  const [tab, setTab] = useState<'shadergraph' | 'shaderlab' | 'glsl' | 'import'>(
    initialTab
  );
  const [copied, setCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const safeFilename = (project.name || 'CustomShader')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/__+/g, '_');

  const unityShaderGraphText = useMemo(
    () => (isOpen ? exportToUnityShaderGraph(project) : ''),
    [isOpen, project]
  );

  const unityShaderLabText = useMemo(
    () => (isOpen ? compileToUnityShaderLab(project) : ''),
    [isOpen, project]
  );

  const webglGlslText = useMemo(
    () => (isOpen ? compileToWebGL(project).fragmentShader : ''),
    [isOpen, project]
  );

  if (!isOpen) return null;

  const activeCode =
    tab === 'shadergraph'
      ? unityShaderGraphText
      : tab === 'shaderlab'
      ? unityShaderLabText
      : webglGlslText;

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyShareUrl = async () => {
    const encoded = btoa(encodeURIComponent(JSON.stringify(project)));
    const url = `${window.location.origin}${window.location.pathname}#graph=${encoded}`;
    await navigator.clipboard.writeText(url);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setImportError(null);
        const imported = importShaderGraphFile(String(reader.result), file.name);
        onImportProject(imported);
        onClose();
      } catch (err: any) {
        setImportError(err?.message || 'Failed to parse .shadergraph file.');
      }
    };
    reader.readAsText(file);
  };

  const handlePasteImport = () => {
    if (!pasteContent.trim()) return;
    try {
      setImportError(null);
      const imported = importShaderGraphFile(pasteContent, 'PastedShaderGraph');
      onImportProject(imported);
      setPasteContent('');
      onClose();
    } catch (err: any) {
      setImportError(err?.message || 'Failed to parse pasted .shadergraph content.');
    }
  };

  return (
    <div className="sg-modal-backdrop" onClick={onClose}>
      <div
        className="sg-export-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sg-addnode-header">
          <div className="sg-addnode-title">
            <FileCode size={16} />
            <span>Export, Inspect & Import Unity Shader Graph</span>
          </div>
          <button type="button" className="sg-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Prominent 1-Click Export Cards */}
        <div className="sg-export-cards-row">
          <button
            type="button"
            id="btn-download-shadergraph"
            className="sg-export-big-btn sg-export-primary"
            onClick={() =>
              triggerFileDownload(`${safeFilename}.shadergraph`, unityShaderGraphText)
            }
          >
            <Download size={16} />
            <div>
              <div className="sg-export-btn-title">
                Download <code>{safeFilename}.shadergraph</code>
              </div>
              <div className="sg-export-btn-sub">
                Native Unity 2022/6 SGVersion 3 asset — opens in Unity Shader Graph Editor
              </div>
            </div>
          </button>

          <button
            type="button"
            id="btn-download-shader"
            className="sg-export-big-btn sg-export-secondary"
            onClick={() =>
              triggerFileDownload(`${safeFilename}.shader`, unityShaderLabText)
            }
          >
            <Code2 size={16} />
            <div>
              <div className="sg-export-btn-title">
                Download <code>{safeFilename}.shader</code>
              </div>
              <div className="sg-export-btn-sub">
                Standalone compiled URP ShaderLab / HLSL shader file
              </div>
            </div>
          </button>

          <button
            type="button"
            className="sg-export-big-btn"
            onClick={handleCopyShareUrl}
          >
            {urlCopied ? <Check size={16} /> : <Share2 size={16} />}
            <div>
              <div className="sg-export-btn-title">
                {urlCopied ? 'Share Link Copied!' : 'Copy Shareable Web URL'}
              </div>
              <div className="sg-export-btn-sub">
                Share this graph via browser link or save JSON
              </div>
            </div>
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="sg-export-tabs">
          <button
            type="button"
            className={`sg-export-tab ${tab === 'shadergraph' ? 'active' : ''}`}
            onClick={() => setTab('shadergraph')}
          >
            Unity .shadergraph (JSON v3)
          </button>
          <button
            type="button"
            className={`sg-export-tab ${tab === 'shaderlab' ? 'active' : ''}`}
            onClick={() => setTab('shaderlab')}
          >
            Unity URP .shader (HLSL)
          </button>
          <button
            type="button"
            className={`sg-export-tab ${tab === 'glsl' ? 'active' : ''}`}
            onClick={() => setTab('glsl')}
          >
            WebGL Preview (GLSL)
          </button>
          <button
            type="button"
            className={`sg-export-tab ${tab === 'import' ? 'active' : ''}`}
            onClick={() => setTab('import')}
          >
            Import .shadergraph
          </button>
        </div>

        {/* Code Viewer or Import View */}
        {tab !== 'import' ? (
          <div className="sg-code-viewer-wrap">
            <div className="sg-code-toolbar">
              <span>
                {tab === 'shadergraph'
                  ? `${safeFilename}.shadergraph (${unityShaderGraphText.split('\n').length} lines)`
                  : tab === 'shaderlab'
                  ? `${safeFilename}.shader (${unityShaderLabText.split('\n').length} lines)`
                  : 'WebGL2 Fragment Shader (GLSL)'}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="sg-code-action-btn"
                  onClick={() =>
                    triggerFileDownload(
                      `${safeFilename}.json`,
                      JSON.stringify(project, null, 2)
                    )
                  }
                >
                  <FileJson size={13} />
                  <span>Export .json</span>
                </button>
                <button
                  type="button"
                  className="sg-code-action-btn"
                  onClick={handleCopyCode}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>
            <pre className="sg-code-pre">
              <code>{activeCode}</code>
            </pre>
          </div>
        ) : (
          <div className="sg-import-panel">
            <label className="sg-import-dropzone">
              <Upload size={24} />
              <div className="sg-import-drop-title">
                Select a Unity <code>.shadergraph</code> or Project <code>.json</code> file
              </div>
              <div className="sg-import-drop-sub">
                Parses Unity SGVersion 3 multi-JSON files (Nodes, Edges, BlockNodes, Blackboard Properties, Groups) and preserves unknown nodes
              </div>
              <input
                type="file"
                accept=".shadergraph,.json,text/plain"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </label>

            <div className="sg-import-paste-section">
              <label>Or paste raw <code>.shadergraph</code> contents below:</label>
              <textarea
                rows={7}
                placeholder='Paste Unity .shadergraph multi-JSON content here (starting with {"m_SGVersion": 3, "m_Type": "UnityEditor.ShaderGraph.GraphData"...})'
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />
              {importError && <div className="sg-import-error">{importError}</div>}
              <button
                type="button"
                className="sg-btn-primary"
                onClick={handlePasteImport}
              >
                Import Pasted ShaderGraph
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
