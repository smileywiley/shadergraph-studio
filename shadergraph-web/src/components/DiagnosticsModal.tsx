import React, { useEffect, useState } from 'react';
import { ShaderGraphProject } from '../types/shadergraph';
import { compileToWebGL } from '../compiler/shaderCompiler';
import {
  DiagnosticEntry,
  getDiagnostics,
  clearDiagnostics,
  getWebGLDeviceInfo,
  subscribeDiagnostics,
  validateShaderProgram,
} from '../utils/diagnosticsStore';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  X,
  Cpu,
  Code2,
} from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ShaderGraphProject;
  onResetToDefaultTemplate: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  project,
  onResetToDefaultTemplate,
}) => {
  const [entries, setEntries] = useState<DiagnosticEntry[]>(() => getDiagnostics());
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'errors' | 'gpu' | 'shader'>('errors');

  useEffect(() => {
    setEntries(getDiagnostics());
    return subscribeDiagnostics(() => {
      setEntries(getDiagnostics());
    });
  }, []);

  if (!isOpen) return null;

  const deviceInfo = getWebGLDeviceInfo();
  const compiledMain = compileToWebGL(project);

  const handleRunSelfTest = () => {
    validateShaderProgram(
      'MainPreview3D (Manual Test)',
      compiledMain.vertexShader,
      compiledMain.fragmentShader
    );
    for (const node of project.nodes) {
      if (node.typeId === 'master-lit') continue;
      const nodeCompiled = compileToWebGL(project, node.id);
      validateShaderProgram(
        `NodePreview:${node.typeId}(${node.id})`,
        nodeCompiled.vertexShader,
        nodeCompiled.fragmentShader
      );
    }
    setEntries(getDiagnostics());
  };

  const handleCopyReport = async () => {
    const report = {
      timestamp: new Date().toISOString(),
      projectName: project.name,
      nodeCount: project.nodes.length,
      edgeCount: project.edges.length,
      deviceInfo,
      diagnostics: entries,
      mainFragmentShader: compiledMain.fragmentShader,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const errorCount = entries.filter((e) => e.level === 'error').length;

  return (
    <div className="sg-modal-backdrop" onClick={onClose}>
      <div
        className="sg-export-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 820 }}
      >
        {/* Header */}
        <div className="sg-addnode-header">
          <div className="sg-addnode-title">
            {errorCount > 0 ? (
              <AlertTriangle size={17} color="#f87171" />
            ) : (
              <CheckCircle2 size={17} color="#34d399" />
            )}
            <span>
              WebGL & Shader Diagnostics{' '}
              {errorCount > 0 ? `(${errorCount} Error${errorCount > 1 ? 's' : ''})` : '(All Healthy)'}
            </span>
          </div>
          <button
            type="button"
            className="sg-icon-btn"
            onClick={onClose}
            aria-label="Close Diagnostics Modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-panel-elevated)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              className="sg-code-action-btn"
              onClick={handleRunSelfTest}
              style={{
                background: 'rgba(14, 165, 233, 0.16)',
                borderColor: 'rgba(56, 189, 248, 0.45)',
                color: '#38bdf8',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={13} />
              <span>Re-Validate All Node & 3D Shaders</span>
            </button>

            <button
              type="button"
              className="sg-code-action-btn"
              onClick={handleCopyReport}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copied Report!' : 'Copy Diagnostics JSON'}</span>
            </button>

            <button
              type="button"
              className="sg-code-action-btn"
              onClick={() => clearDiagnostics()}
            >
              <Trash2 size={13} />
              <span>Clear Logs</span>
            </button>
          </div>

          <button
            type="button"
            className="sg-code-action-btn"
            onClick={() => {
              onResetToDefaultTemplate();
              clearDiagnostics();
            }}
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              borderColor: 'rgba(245, 158, 11, 0.45)',
              color: '#fbbf24',
            }}
            title="Clear browser localStorage cache and reload fresh default template"
          >
            <RefreshCw size={13} />
            <span>Reset Cached Graph</span>
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="sg-export-tabs">
          <button
            type="button"
            className={`sg-export-tab ${activeTab === 'errors' ? 'active' : ''}`}
            onClick={() => setActiveTab('errors')}
          >
            Error & Warning Log ({entries.length})
          </button>
          <button
            type="button"
            className={`sg-export-tab ${activeTab === 'gpu' ? 'active' : ''}`}
            onClick={() => setActiveTab('gpu')}
          >
            <Cpu size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
            Device & WebGL Info
          </button>
          <button
            type="button"
            className={`sg-export-tab ${activeTab === 'shader' ? 'active' : ''}`}
            onClick={() => setActiveTab('shader')}
          >
            <Code2 size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
            Active GLSL Source
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: '62vh',
          }}
        >
          {activeTab === 'errors' && (
            <>
              {entries.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    borderRadius: 8,
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    color: '#a7f3d0',
                  }}
                >
                  <CheckCircle2 size={24} color="#34d399" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#ecfdf5' }}>
                      0 WebGL or Runtime Errors Detected
                    </div>
                    <div style={{ fontSize: 12, marginTop: 3, opacity: 0.9 }}>
                      All active node shaders and the 3D Main Preview shader compiled and linked
                      cleanly on <strong>{deviceInfo.unmaskedRenderer || deviceInfo.renderer}</strong>.
                    </div>
                  </div>
                </div>
              ) : (
                entries.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border:
                        item.level === 'error'
                          ? '1px solid rgba(248, 113, 113, 0.45)'
                          : '1px solid rgba(251, 191, 36, 0.45)',
                      background:
                        item.level === 'error'
                          ? 'rgba(127, 29, 29, 0.22)'
                          : 'rgba(120, 53, 15, 0.22)',
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 12.5,
                          color: item.level === 'error' ? '#fca5a5' : '#fde68a',
                        }}
                      >
                        [{item.source}] {item.message}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10.5,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {item.details && (
                      <pre
                        style={{
                          margin: 0,
                          padding: 10,
                          borderRadius: 6,
                          background: '#090b10',
                          color: '#fecaca',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: 220,
                          overflowY: 'auto',
                        }}
                      >
                        {item.details}
                      </pre>
                    )}

                    {(item.fragmentShader || item.vertexShader) && (
                      <details style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                          Show Compiled GLSL Source (with line numbers)
                        </summary>
                        {item.fragmentShader && (
                          <pre
                            style={{
                              marginTop: 6,
                              padding: 10,
                              borderRadius: 6,
                              background: '#090b10',
                              color: '#cbd5e1',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10.5,
                              maxHeight: 240,
                              overflow: 'auto',
                            }}
                          >
                            {item.fragmentShader}
                          </pre>
                        )}
                      </details>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'gpu' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 10,
              }}
            >
              {[
                ['WebGL Version', deviceInfo.webglVersion],
                ['GLSL Version', deviceInfo.glslVersion],
                ['GPU Renderer', deviceInfo.unmaskedRenderer || deviceInfo.renderer],
                ['Vendor', deviceInfo.vendor],
                ['Max Varying Vectors', String(deviceInfo.maxVaryingVectors)],
                ['Max Texture Units', String(deviceInfo.maxTextureUnits)],
                [
                  'Max Fragment Uniform Vectors',
                  String(deviceInfo.maxFragmentUniformVectors),
                ],
                ['User Agent', deviceInfo.userAgent],
              ].map(([label, val]) => (
                <div
                  key={label}
                  style={{
                    padding: 10,
                    borderRadius: 7,
                    background: 'var(--bg-panel-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      marginTop: 4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {val}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'shader' && (
            <pre className="sg-code-pre" style={{ borderRadius: 8, maxHeight: '52vh' }}>
              {`// === VERTEX SHADER ===\n${compiledMain.vertexShader}\n\n// === FRAGMENT SHADER ===\n${compiledMain.fragmentShader}`}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
