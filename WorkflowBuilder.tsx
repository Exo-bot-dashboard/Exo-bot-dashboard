import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Zap,
  Play,
  GitBranch,
  Variable,
  MessageCircle,
  Save,
  Trash2,
  AlertCircle,
  TestTube,
  Eraser,
  HelpCircle,
  Plus,
  X,
  Menu,
  Sparkles,
} from 'lucide-react';
import { useWorkflowGraph, WorkflowGraphNode } from '@/hooks/useWorkflowGraph';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type {
  Workflow,
  WorkflowNode,
} from '@shared/schema';

type WorkflowNodeType = 'trigger' | 'action' | 'condition' | 'variable' | 'response';

interface CustomNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  nodeData: any;
}

function TriggerNode({ data, selected }: NodeProps<CustomNodeData>) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 min-w-[150px] ${
        selected ? 'border-blue-500 shadow-lg' : 'border-purple-300 dark:border-purple-700'
      }`}
    >
      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
        <Zap size={16} />
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-purple-500" />
    </div>
  );
}

function ActionNode({ data, selected }: NodeProps<CustomNodeData>) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 min-w-[150px] ${
        selected ? 'border-blue-500 shadow-lg' : 'border-green-300 dark:border-green-700'
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-green-500" />
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
        <Play size={16} />
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500" />
    </div>
  );
}

function ConditionNode({ data, selected }: NodeProps<CustomNodeData>) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 min-w-[150px] ${
        selected ? 'border-blue-500 shadow-lg' : 'border-yellow-300 dark:border-yellow-700'
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-yellow-500" />
      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
        <GitBranch size={16} />
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-yellow-500" />
    </div>
  );
}

function VariableNode({ data, selected }: NodeProps<CustomNodeData>) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 min-w-[150px] ${
        selected ? 'border-blue-500 shadow-lg' : 'border-cyan-300 dark:border-cyan-700'
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-cyan-500" />
      <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
        <Variable size={16} />
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-cyan-500" />
    </div>
  );
}

function ResponseNode({ data, selected }: NodeProps<CustomNodeData>) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 min-w-[150px] ${
        selected ? 'border-blue-500 shadow-lg' : 'border-pink-300 dark:border-pink-700'
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-pink-500" />
      <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400">
        <MessageCircle size={16} />
        <div className="font-semibold text-sm">{data.label}</div>
      </div>
    </div>
  );
}

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  variable: VariableNode,
  response: ResponseNode,
};

interface WorkflowCanvasProps {
  nodes: WorkflowGraphNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodesChange: any;
  onConnect: any;
  onEdgesDelete: any;
  setSelectedNodeId: (id: string | null) => void;
  removeNode: (id: string) => void;
  onDropTemplate?: (template: typeof WORKFLOW_TEMPLATES[0]) => void;
}

export function WorkflowCanvas({
  nodes,
  edges,
  selectedNodeId,
  onNodesChange,
  onConnect,
  onEdgesDelete,
  setSelectedNodeId,
  removeNode,
  onDropTemplate,
}: WorkflowCanvasProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedNodeId) {
        removeNode(selectedNodeId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, removeNode]);

  const handleNodeClick = useCallback(
    (_event: any, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const showEmptyState = nodes.length === 0;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const templateData = e.dataTransfer.getData('application/workflow-template');
    if (templateData && onDropTemplate) {
      const template = JSON.parse(templateData);
      onDropTemplate(template);
    }
  }, [onDropTemplate]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div 
      className="h-full w-full bg-gray-50 dark:bg-gray-900 relative" 
      data-testid="canvas-workflow"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <ReactFlow
        nodes={nodes as Node[]}
        edges={edges}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{
          animated: true,
          type: 'smoothstep',
        }}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'trigger') return '#9333ea';
            if (node.type === 'action') return '#22c55e';
            if (node.type === 'condition') return '#eab308';
            if (node.type === 'variable') return '#06b6d4';
            if (node.type === 'response') return '#ec4899';
            return '#gray';
          }}
        />
      </ReactFlow>
      {showEmptyState && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md mx-4 border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Sparkles className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold dark:text-white">Start Building Your Workflow</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Create custom Discord commands with a visual drag-and-drop interface. No coding required!
              </p>
              <div className="space-y-2 text-left text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">1.</span>
                  <span className="dark:text-gray-300">Click blocks from the left panel to add them</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">2.</span>
                  <span className="dark:text-gray-300">Connect blocks by dragging from the dots</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">3.</span>
                  <span className="dark:text-gray-300">Configure each block in the right panel</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">4.</span>
                  <span className="dark:text-gray-300">Save your workflow to create the command</span>
                </div>
              </div>
              <div className="pt-2 text-xs text-gray-500 dark:text-gray-500">
                💡 Tip: Every workflow needs at least one Trigger and one Response block
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface NodePaletteProps {
  addNode: (type: WorkflowNodeType, position: { x: number; y: number }) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export function NodePalette({ addNode, isOpen, onClose, onOpen }: NodePaletteProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const nodeTypesConfig = [
    {
      type: 'trigger' as WorkflowNodeType,
      icon: <Zap size={20} />,
      label: 'Trigger',
      description: 'Start workflow on event',
      color: 'border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20',
      testId: 'button-add-trigger',
    },
    {
      type: 'action' as WorkflowNodeType,
      icon: <Play size={20} />,
      label: 'Action',
      description: 'Perform an action',
      color: 'border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20',
      testId: 'button-add-action',
    },
    {
      type: 'condition' as WorkflowNodeType,
      icon: <GitBranch size={20} />,
      label: 'Condition',
      description: 'Branch based on condition',
      color: 'border-yellow-300 dark:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
      testId: 'button-add-condition',
    },
    {
      type: 'variable' as WorkflowNodeType,
      icon: <Variable size={20} />,
      label: 'Variable',
      description: 'Store or get data',
      color: 'border-cyan-300 dark:border-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-900/20',
      testId: 'button-add-variable',
    },
    {
      type: 'response' as WorkflowNodeType,
      icon: <MessageCircle size={20} />,
      label: 'Response',
      description: 'Send a message',
      color: 'border-pink-300 dark:border-pink-700 hover:bg-pink-50 dark:hover:bg-pink-900/20',
      testId: 'button-add-response',
    },
  ];

  const handleAddNode = (type: WorkflowNodeType) => {
    const position = {
      x: Math.random() * 300 + 100,
      y: Math.random() * 300 + 100,
    };
    addNode(type, position);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile FAB */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed bottom-6 left-6 z-50 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition"
        data-testid="button-toggle-palette"
      >
        {isMobileOpen ? <X size={24} /> : <Plus size={24} />}
      </button>

      {/* Desktop FAB - show when closed */}
      {!isOpen && (
        <button
          onClick={onOpen}
          className="hidden md:block fixed top-20 left-6 z-50 bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition"
          data-testid="button-reopen-palette"
          title="Show blocks panel"
        >
          <Plus size={20} />
        </button>
      )}

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
          data-testid="overlay-mobile-palette"
        />
      )}

      {/* Panel */}
      <div className={`
        w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto
        fixed inset-y-0 left-0 z-40 transition-transform duration-300
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isOpen ? 'md:relative md:translate-x-0' : 'md:hidden'}
      `}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-lg font-bold dark:text-white">Blocks</h3>
          <button
            onClick={() => {
              onClose();
              setIsMobileOpen(false);
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
            data-testid="button-close-palette"
            title="Close blocks panel"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {nodeTypesConfig.map((config) => (
            <button
              key={config.type}
              onClick={() => handleAddNode(config.type)}
              data-testid={config.testId}
              className={`w-full p-3 rounded-lg border-2 ${config.color} bg-white dark:bg-gray-800 text-left transition-colors`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="dark:text-white">{config.icon}</span>
                <span className="font-semibold dark:text-white">{config.label}</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{config.description}</p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

interface NodeInspectorProps {
  selectedNodeId: string | null;
  nodes: WorkflowGraphNode[];
  updateNodeData: (nodeId: string, updates: any) => void;
  removeNode: (nodeId: string) => void;
}

export function NodeInspector({
  selectedNodeId,
  nodes,
  updateNodeData,
  removeNode,
}: NodeInspectorProps) {
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div className="p-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
          Select a node to edit its properties
        </p>
      </div>
    );
  }

  const handleLabelChange = (label: string) => {
    updateNodeData(selectedNode.id, {
      ...selectedNode.data.nodeData,
      label,
    });
  };

  const handleConfigChange = (field: string, value: any) => {
    updateNodeData(selectedNode.id, {
      ...selectedNode.data.nodeData,
      config: {
        ...selectedNode.data.nodeData.config,
        [field]: value,
      },
    });
  };

  const handleDelete = () => {
    removeNode(selectedNode.id);
  };

  return (
    <div className="p-4 overflow-y-auto">
      <h3 className="text-lg font-bold mb-4 dark:text-white">Node Properties</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">
            Node Type
          </label>
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded text-sm dark:text-white capitalize">
            {selectedNode.data.nodeType}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-300">
            Label
          </label>
          <input
            type="text"
            value={selectedNode.data.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
            data-testid="input-node-label"
          />
        </div>

        {selectedNode.data.nodeType === 'trigger' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Trigger Type
              </label>
              <select
                value={(selectedNode.data.nodeData.config as any)?.type || 'slash'}
                onChange={(e) => handleConfigChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                data-testid="select-trigger-type"
              >
                <option value="slash">Slash Command</option>
                <option value="prefix">Prefix Command</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Command Name
              </label>
              <input
                type="text"
                value={(selectedNode.data.nodeData.config as any)?.commandName || ''}
                onChange={(e) => handleConfigChange('commandName', e.target.value)}
                placeholder="mycommand"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                data-testid="input-command-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Description
              </label>
              <input
                type="text"
                value={(selectedNode.data.nodeData.config as any)?.description || ''}
                onChange={(e) => handleConfigChange('description', e.target.value)}
                placeholder="Command description"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                data-testid="input-command-description"
              />
            </div>
          </>
        )}

        {selectedNode.data.nodeType === 'action' && (
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">
              Action Type
            </label>
            <select
              value={(selectedNode.data.nodeData.config as any)?.actionType || 'send_message'}
              onChange={(e) => handleConfigChange('actionType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
              data-testid="select-action-type"
            >
              <option value="send_message">Send Message</option>
              <option value="add_role">Add Role</option>
              <option value="remove_role">Remove Role</option>
              <option value="ban">Ban User</option>
              <option value="kick">Kick User</option>
              <option value="timeout">Timeout User</option>
            </select>
          </div>
        )}

        {selectedNode.data.nodeType === 'condition' && (
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">
              Condition Type
            </label>
            <select
              value={(selectedNode.data.nodeData.config as any)?.conditionType || 'has_role'}
              onChange={(e) => handleConfigChange('conditionType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
              data-testid="select-condition-type"
            >
              <option value="has_role">Has Role</option>
              <option value="has_permission">Has Permission</option>
              <option value="variable_equals">Variable Equals</option>
            </select>
          </div>
        )}

        {selectedNode.data.nodeType === 'variable' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Operation
              </label>
              <select
                value={(selectedNode.data.nodeData.config as any)?.operation || 'set'}
                onChange={(e) => handleConfigChange('operation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                data-testid="select-variable-operation"
              >
                <option value="set">Set</option>
                <option value="get">Get</option>
                <option value="increment">Increment</option>
                <option value="decrement">Decrement</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Variable Name
              </label>
              <input
                type="text"
                value={(selectedNode.data.nodeData.config as any)?.variableName || ''}
                onChange={(e) => handleConfigChange('variableName', e.target.value)}
                placeholder="variableName"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                data-testid="input-variable-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                Value
              </label>
              <input
                type="text"
                value={(selectedNode.data.nodeData.config as any)?.value || ''}
                onChange={(e) => handleConfigChange('value', e.target.value)}
                placeholder="value"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
                data-testid="input-variable-value"
              />
            </div>
          </>
        )}

        {selectedNode.data.nodeType === 'response' && (
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">
              Response Message
            </label>
            <textarea
              value={(selectedNode.data.nodeData.config as any)?.message || ''}
              onChange={(e) => handleConfigChange('message', e.target.value)}
              placeholder="Enter response message..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white"
              data-testid="textarea-response-message"
            />
          </div>
        )}

        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          data-testid="button-delete-node"
        >
          <Trash2 size={16} />
          Delete Node
        </button>
      </div>
    </div>
  );
}

// Unified Right Panel with Tabs
interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'inspector' | 'templates';
  onTabChange: (tab: 'inspector' | 'templates') => void;
  selectedNodeId: string | null;
  nodes: WorkflowGraphNode[];
  updateNodeData: (nodeId: string, updates: any) => void;
  removeNode: (nodeId: string) => void;
  onSelectTemplate: (template: typeof WORKFLOW_TEMPLATES[0]) => void;
}

function RightPanel({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  selectedNodeId,
  nodes,
  updateNodeData,
  removeNode,
  onSelectTemplate,
}: RightPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="md:hidden fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        data-testid="overlay-right-panel"
      />

      {/* Panel container - desktop: fixed right, mobile: bottom drawer */}
      <div
        className={`
          fixed bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50
          md:top-16 md:right-0 md:bottom-0 md:w-80
          max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:rounded-t-2xl max-md:max-h-[80vh]
          flex flex-col
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with tabs and close button */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
          <div className="flex flex-1">
            <button
              onClick={() => onTabChange('inspector')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                activeTab === 'inspector'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              data-testid="tab-inspector"
            >
              Inspector
            </button>
            <button
              onClick={() => onTabChange('templates')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                activeTab === 'templates'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              data-testid="tab-templates"
            >
              Templates
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            data-testid="button-close-panel"
            title="Close panel (ESC)"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'inspector' && (
            <NodeInspector
              selectedNodeId={selectedNodeId}
              nodes={nodes}
              updateNodeData={updateNodeData}
              removeNode={removeNode}
            />
          )}
          {activeTab === 'templates' && (
            <TemplateList onSelectTemplate={onSelectTemplate} />
          )}
        </div>
      </div>
    </>
  );
}

// Extracted Template List Component
interface TemplateListProps {
  onSelectTemplate: (template: typeof WORKFLOW_TEMPLATES[0]) => void;
}

function TemplateList({ onSelectTemplate }: TemplateListProps) {
  const handleDragStart = (e: React.DragEvent, template: typeof WORKFLOW_TEMPLATES[0]) => {
    e.dataTransfer.setData('application/workflow-template', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="p-4 space-y-3">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="text-purple-500" size={20} />
          <h3 className="font-bold dark:text-white">Starter Templates</h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <span className="hidden md:inline">Drag & drop onto canvas or </span>Click to load
        </p>
      </div>
      {WORKFLOW_TEMPLATES.map((template) => (
        <div
          key={template.id}
          draggable
          onDragStart={(e) => handleDragStart(e, template)}
          onClick={() => onSelectTemplate(template)}
          className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-500 transition cursor-pointer bg-white dark:bg-gray-800 group"
          data-testid={`template-${template.id}`}
        >
          <div className="flex items-start gap-3 mb-2">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded group-hover:bg-purple-50 dark:group-hover:bg-purple-900/20 transition">
              {template.icon}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold dark:text-white text-sm mb-1">{template.name}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">{template.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const WORKFLOW_TEMPLATES = [
  {
    id: 'simple',
    name: 'Simple Command',
    description: 'A basic command that responds with a message',
    icon: <MessageCircle className="text-pink-500" size={24} />,
    nodes: [
      {
        id: '1',
        type: 'trigger' as const,
        position: { x: 100, y: 100 },
        data: {
          label: 'Command Trigger',
          nodeType: 'trigger' as const,
          nodeData: {
            label: 'Command Trigger',
            config: { type: 'slash', commandName: 'hello', description: 'Say hello' },
            ports: { outputs: [{ id: 'out', type: 'default' }] },
          },
        },
      },
      {
        id: '2',
        type: 'response' as const,
        position: { x: 400, y: 100 },
        data: {
          label: 'Send Message',
          nodeType: 'response' as const,
          nodeData: {
            label: 'Send Message',
            config: { message: 'Hello! 👋' },
            ports: { inputs: [{ id: 'in', type: 'default' }] },
          },
        },
      },
    ],
    edges: [{ id: 'e1-2', source: '1', target: '2', sourceHandle: 'out', targetHandle: 'in' }],
  },
  {
    id: 'role-check',
    name: 'Role Check',
    description: 'Different responses based on user role',
    icon: <GitBranch className="text-yellow-500" size={24} />,
    nodes: [
      {
        id: '1',
        type: 'trigger' as const,
        position: { x: 100, y: 150 },
        data: {
          label: 'Command Trigger',
          nodeType: 'trigger' as const,
          nodeData: {
            label: 'Command Trigger',
            config: { type: 'slash', commandName: 'check', description: 'Check your role' },
            ports: { outputs: [{ id: 'out', type: 'default' }] },
          },
        },
      },
      {
        id: '2',
        type: 'condition' as const,
        position: { x: 400, y: 150 },
        data: {
          label: 'Has Admin Role?',
          nodeType: 'condition' as const,
          nodeData: {
            label: 'Has Admin Role?',
            config: { conditionType: 'has_role' },
            ports: {
              inputs: [{ id: 'in', type: 'default' }],
              outputs: [
                { id: 'true', type: 'default' },
                { id: 'false', type: 'default' },
              ],
            },
          },
        },
      },
      {
        id: '3',
        type: 'response' as const,
        position: { x: 700, y: 80 },
        data: {
          label: 'Admin Response',
          nodeType: 'response' as const,
          nodeData: {
            label: 'Admin Response',
            config: { message: 'You have admin permissions! ⭐' },
            ports: { inputs: [{ id: 'in', type: 'default' }] },
          },
        },
      },
      {
        id: '4',
        type: 'response' as const,
        position: { x: 700, y: 220 },
        data: {
          label: 'Normal Response',
          nodeType: 'response' as const,
          nodeData: {
            label: 'Normal Response',
            config: { message: 'You are a regular member.' },
            ports: { inputs: [{ id: 'in', type: 'default' }] },
          },
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2-3', source: '2', target: '3', sourceHandle: 'true', targetHandle: 'in' },
      { id: 'e2-4', source: '2', target: '4', sourceHandle: 'false', targetHandle: 'in' },
    ],
  },
  {
    id: 'counter',
    name: 'Variable Counter',
    description: 'Command that increments and displays a counter',
    icon: <Variable className="text-cyan-500" size={24} />,
    nodes: [
      {
        id: '1',
        type: 'trigger' as const,
        position: { x: 100, y: 100 },
        data: {
          label: 'Command Trigger',
          nodeType: 'trigger' as const,
          nodeData: {
            label: 'Command Trigger',
            config: { type: 'slash', commandName: 'count', description: 'Increment counter' },
            ports: { outputs: [{ id: 'out', type: 'default' }] },
          },
        },
      },
      {
        id: '2',
        type: 'variable' as const,
        position: { x: 400, y: 100 },
        data: {
          label: 'Increment Count',
          nodeType: 'variable' as const,
          nodeData: {
            label: 'Increment Count',
            config: { operation: 'increment', variableName: 'count', value: '1' },
            ports: {
              inputs: [{ id: 'in', type: 'default' }],
              outputs: [{ id: 'out', type: 'default' }],
            },
          },
        },
      },
      {
        id: '3',
        type: 'response' as const,
        position: { x: 700, y: 100 },
        data: {
          label: 'Show Count',
          nodeType: 'response' as const,
          nodeData: {
            label: 'Show Count',
            config: { message: 'Counter: {{count}} 🔢' },
            ports: { inputs: [{ id: 'in', type: 'default' }] },
          },
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2-3', source: '2', target: '3', sourceHandle: 'out', targetHandle: 'in' },
    ],
  },
];

function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold dark:text-white">Workflow Builder Guide</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            data-testid="button-close-help"
          >
            <X size={20} className="dark:text-white" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-2 dark:text-white">What are Workflows?</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Workflows let you create custom Discord commands using a visual drag-and-drop interface. 
              Each workflow is a sequence of connected blocks that define what happens when a user runs your command.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 dark:text-white">Available Blocks</h3>
            <div className="space-y-3">
              <div className="flex gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-700">
                <Zap className="text-purple-600 dark:text-purple-400 flex-shrink-0" size={20} />
                <div>
                  <div className="font-semibold dark:text-white">Trigger</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Starts your workflow. Choose slash command or prefix command. Required for every workflow.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                <Play className="text-green-600 dark:text-green-400 flex-shrink-0" size={20} />
                <div>
                  <div className="font-semibold dark:text-white">Action</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Performs an action like sending messages, adding roles, or moderating users.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                <GitBranch className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" size={20} />
                <div>
                  <div className="font-semibold dark:text-white">Condition</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Creates different paths based on roles, permissions, or variable values.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded border border-cyan-200 dark:border-cyan-700">
                <Variable className="text-cyan-600 dark:text-cyan-400 flex-shrink-0" size={20} />
                <div>
                  <div className="font-semibold dark:text-white">Variable</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Stores and retrieves data during workflow execution.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-3 bg-pink-50 dark:bg-pink-900/20 rounded border border-pink-200 dark:border-pink-700">
                <MessageCircle className="text-pink-600 dark:text-pink-400 flex-shrink-0" size={20} />
                <div>
                  <div className="font-semibold dark:text-white">Response</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Sends a message to the user. At least one required per workflow.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 dark:text-white">How to Build</h3>
            <ol className="space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex gap-2">
                <span className="font-semibold">1.</span>
                <span>Click a block from the left panel to add it to the canvas</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">2.</span>
                <span>Drag blocks to reposition them on the canvas</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">3.</span>
                <span>Connect blocks by dragging from the dot on one block to another</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">4.</span>
                <span>Click a block to select it and edit its properties in the right panel</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">5.</span>
                <span>Save your workflow to create the Discord command</span>
              </li>
            </ol>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 dark:text-white">Tips</h3>
            <ul className="space-y-1 text-gray-600 dark:text-gray-400 text-sm">
              <li>• Every workflow needs exactly one Trigger block</li>
              <li>• Every workflow needs at least one Response block</li>
              <li>• Use the Delete key or trash button to remove selected blocks</li>
              <li>• Validation warnings will show if your workflow has issues</li>
              <li>• Give your workflow a descriptive name before saving</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

interface WorkflowToolbarProps {
  workflowName: string;
  setWorkflowName: (name: string) => void;
  validationWarnings: string[];
  onSave: () => void;
  onClear: () => void;
  onLoadTemplate: () => void;
  isSaving: boolean;
}

export function WorkflowToolbar({
  workflowName,
  setWorkflowName,
  validationWarnings,
  onSave,
  onClear,
  onLoadTemplate,
  isSaving,
}: WorkflowToolbarProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-1">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow Name"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-lg font-semibold"
              data-testid="input-workflow-name"
            />
            {validationWarnings.length > 0 && (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertCircle size={20} />
                <span className="text-sm" data-testid="text-validation-warnings">
                  {validationWarnings.length} warning(s)
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onLoadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition"
              data-testid="button-load-template"
              title="Load a pre-built workflow template"
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">Template</span>
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              data-testid="button-help"
            >
              <HelpCircle size={16} />
              <span className="hidden sm:inline">Help</span>
            </button>
            <button
              onClick={onClear}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              data-testid="button-clear-canvas"
            >
              <Eraser size={16} />
              <span className="hidden sm:inline">Clear</span>
            </button>
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded cursor-not-allowed"
              data-testid="button-test-workflow"
            >
              <TestTube size={16} />
              <span className="hidden sm:inline">Test</span>
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition"
              data-testid="button-save-workflow"
              title="Save workflow - this will create a Discord command"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        {validationWarnings.length > 0 && (
          <div className="mt-3 space-y-1">
            {validationWarnings.map((warning, idx) => (
              <div
                key={idx}
                className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2"
                data-testid={`warning-${idx}`}
              >
                <AlertCircle size={14} />
                {warning}
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          💡 Saving your workflow will automatically create a Discord command
        </div>
      </div>
    </>
  );
}

export default function WorkflowBuilderPage() {
  const [match, params] = useRoute<{ id: string }>('/workflows/:id');
  const [, setLocation] = useLocation();
  const workflowId = match && params ? params.id : null;
  const isNewWorkflow = workflowId === 'new';

  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [commandName, setCommandName] = useState('');
  const [commandType, setCommandType] = useState<'slash' | 'prefix'>('slash');
  const [guildId] = useState(1);

  // Left panel (NodePalette) state
  const [leftPanelOpen, setLeftPanelOpen] = useState(() => {
    const saved = localStorage.getItem('workflow-palette-open');
    return saved !== null ? saved === 'true' : true;
  });

  // Right panel state
  const [rightPanelOpen, setRightPanelOpen] = useState(() => {
    const saved = localStorage.getItem('workflow-panel-open');
    return saved !== null ? saved === 'true' : true;
  });
  const [activeTab, setActiveTab] = useState<'inspector' | 'templates'>(() => {
    const saved = localStorage.getItem('workflow-panel-tab');
    return (saved as 'inspector' | 'templates') || 'inspector';
  });

  // Persist panel states
  useEffect(() => {
    localStorage.setItem('workflow-palette-open', String(leftPanelOpen));
  }, [leftPanelOpen]);

  useEffect(() => {
    localStorage.setItem('workflow-panel-open', String(rightPanelOpen));
  }, [rightPanelOpen]);

  useEffect(() => {
    localStorage.setItem('workflow-panel-tab', activeTab);
  }, [activeTab]);

  const { data: workflow, isLoading } = useQuery<Workflow & { nodes: WorkflowNode[] }>({
    queryKey: ['/api/workflows', workflowId],
    enabled: !!workflowId && !isNewWorkflow,
  });

  const initialNodes: WorkflowGraphNode[] = workflow?.nodes
    ? workflow.nodes.map((node) => ({
        id: node.id.toString(),
        type: node.nodeType as WorkflowNodeType,
        position: { x: node.positionX, y: node.positionY },
        data: {
          label: (node.nodeData as any).label || node.nodeType,
          nodeType: node.nodeType as WorkflowNodeType,
          nodeData: node.nodeData as any,
        },
      }))
    : [];

  const initialEdges: Edge[] = [];

  const {
    nodes,
    edges,
    selectedNodeId,
    validationWarnings,
    addNode,
    removeNode,
    updateNodeData,
    setSelectedNodeId,
    onConnect,
    onEdgesDelete,
    onNodesChange,
    setNodes,
    setEdges,
  } = useWorkflowGraph(initialNodes, initialEdges);

  useEffect(() => {
    if (workflow && !isNewWorkflow) {
      setWorkflowName(workflow.name);
      setCommandName(workflow.commandName);
      setCommandType(workflow.commandType as 'slash' | 'prefix');
    }
  }, [workflow, isNewWorkflow]);

  // Auto-open inspector when node selected
  useEffect(() => {
    if (selectedNodeId && !rightPanelOpen) {
      setRightPanelOpen(true);
      setActiveTab('inspector');
    }
  }, [selectedNodeId, rightPanelOpen]);

  // ESC key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && rightPanelOpen) {
        setRightPanelOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [rightPanelOpen]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isNewWorkflow) {
        return apiRequest('/api/workflows', 'POST', data);
      } else {
        return apiRequest(`/api/workflows/${workflowId}`, 'PATCH', data);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      if (isNewWorkflow && data?.id) {
        setLocation(`/workflows/${data.id}`);
      }
    },
  });

  const handleSave = () => {
    const workflowData = {
      guildId,
      name: workflowName,
      commandName: commandName || workflowName.toLowerCase().replace(/\s+/g, '-'),
      commandType,
      enabled: true,
      nodes: nodes.map((node) => ({
        nodeType: node.data.nodeType,
        nodeData: node.data.nodeData,
        positionX: node.position.x,
        positionY: node.position.y,
      })),
    };

    saveMutation.mutate(workflowData);
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the entire canvas?')) {
      setNodes([]);
      setEdges([]);
    }
  };

  const handleLoadTemplate = (template: typeof WORKFLOW_TEMPLATES[0]) => {
    if (nodes.length > 0) {
      if (!confirm('Loading a template will replace your current workflow. Continue?')) {
        return;
      }
    }
    setNodes(template.nodes as any);
    setEdges(template.edges as any);
    setWorkflowName(template.name);
    const triggerNode = template.nodes.find(n => n.type === 'trigger');
    if (triggerNode && triggerNode.data.nodeData.config) {
      setCommandName(triggerNode.data.nodeData.config.commandName || '');
      setCommandType((triggerNode.data.nodeData.config.type as 'slash' | 'prefix') || 'slash');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-lg dark:text-white">Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <WorkflowToolbar
        workflowName={workflowName}
        setWorkflowName={setWorkflowName}
        validationWarnings={validationWarnings}
        onSave={handleSave}
        onClear={handleClear}
        onLoadTemplate={() => {
          setRightPanelOpen(true);
          setActiveTab('templates');
        }}
        isSaving={saveMutation.isPending}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <NodePalette 
          addNode={addNode}
          isOpen={leftPanelOpen}
          onClose={() => setLeftPanelOpen(false)}
          onOpen={() => setLeftPanelOpen(true)}
        />
        <div className={`flex-1 transition-all ${rightPanelOpen ? 'md:mr-80' : 'mr-0'}`}>
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            setSelectedNodeId={setSelectedNodeId}
            removeNode={removeNode}
            onDropTemplate={handleLoadTemplate}
          />
        </div>

        {/* Unified Right Panel */}
        <RightPanel
          isOpen={rightPanelOpen}
          onClose={() => setRightPanelOpen(false)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedNodeId={selectedNodeId}
          nodes={nodes}
          updateNodeData={updateNodeData}
          removeNode={removeNode}
          onSelectTemplate={handleLoadTemplate}
        />

        {/* FAB to reopen panel when closed on mobile */}
        {!rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="fixed bottom-6 right-6 z-30 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition md:hidden"
            data-testid="button-open-panel"
            title="Open panel"
          >
            <Menu size={24} />
          </button>
        )}
      </div>
    </div>
  );
}
