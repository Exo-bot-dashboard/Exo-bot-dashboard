import { useState, useCallback, useMemo } from 'react';
import type { Node, Edge, Connection } from 'reactflow';
import type { WorkflowNodeData } from '@shared/schema';
import { nanoid } from 'nanoid';

// Define node type locally since it's not exported from schema
type WorkflowNodeType = 'trigger' | 'action' | 'condition' | 'variable' | 'response';

export interface WorkflowGraphNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    nodeType: WorkflowNodeType;
    nodeData: WorkflowNodeData;
  };
}

export function useWorkflowGraph(initialNodes: WorkflowGraphNode[] = [], initialEdges: Edge[] = []) {
  const [nodes, setNodes] = useState<WorkflowGraphNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const addNode = useCallback((nodeType: WorkflowNodeType, position: { x: number; y: number }) => {
    const nodeId = nanoid();
    
    // Build default config based on node type
    let defaultConfig: any;
    if (nodeType === 'trigger') {
      defaultConfig = { type: 'slash', commandName: 'mycommand' };
    } else if (nodeType === 'action') {
      defaultConfig = { actionType: 'send_message', message: '' };
    } else if (nodeType === 'condition') {
      defaultConfig = { conditionType: 'has_role' };
    } else if (nodeType === 'variable') {
      defaultConfig = { operation: 'set', variableName: 'var1' };
    } else {
      defaultConfig = { message: '', embed: false, ephemeral: false };
    }
    
    const defaultNodeData: WorkflowNodeData = {
      label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
      ports: {
        inputs: nodeType === 'trigger' ? [] : [{ id: 'in', type: 'default' }],
        outputs: nodeType === 'response' ? [] : [{ id: 'out', type: 'default' }]
      },
      edges: {},
      config: defaultConfig
    };

    const newNode: WorkflowGraphNode = {
      id: nodeId,
      type: nodeType,
      position,
      data: {
        label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
        nodeType,
        nodeData: defaultNodeData
      }
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(nodeId);
    return nodeId;
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId]);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<WorkflowNodeData> & { label?: string }) => {
    setNodes(prev => prev.map(node => {
      if (node.id === nodeId) {
        const { label, ...nodeDataUpdates } = updates as any;
        return {
          ...node,
          data: {
            ...node.data,
            ...(label !== undefined ? { label } : {}),
            nodeData: {
              ...node.data.nodeData,
              ...nodeDataUpdates,
              ...(label !== undefined ? { label } : {})
            }
          }
        };
      }
      return node;
    }));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    const edgeId = `${connection.source}-${connection.target}`;
    const newEdge: Edge = {
      id: edgeId,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined
    };

    setEdges(prev => [...prev, newEdge]);

    setNodes(prev => prev.map(node => {
      if (node.id === connection.source) {
        const sourcePortId = connection.sourceHandle || 'out';
        const existingEdges = node.data.nodeData.edges[sourcePortId] || [];
        
        return {
          ...node,
          data: {
            ...node.data,
            nodeData: {
              ...node.data.nodeData,
              edges: {
                ...node.data.nodeData.edges,
                [sourcePortId]: [
                  ...existingEdges,
                  {
                    targetNodeId: connection.target!,
                    targetPortId: connection.targetHandle || 'in'
                  }
                ]
              }
            }
          }
        };
      }
      return node;
    }));
  }, []);

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach(edge => {
      setNodes(prev => prev.map(node => {
        if (node.id === edge.source) {
          const sourcePortId = edge.sourceHandle || 'out';
          const existingEdges = node.data.nodeData.edges[sourcePortId] || [];
          
          return {
            ...node,
            data: {
              ...node.data,
              nodeData: {
                ...node.data.nodeData,
                edges: {
                  ...node.data.nodeData.edges,
                  [sourcePortId]: existingEdges.filter(
                    e => e.targetNodeId !== edge.target || e.targetPortId !== (edge.targetHandle || 'in')
                  )
                }
              }
            }
          };
        }
        return node;
      }));
    });

    setEdges(prev => prev.filter(e => !edgesToDelete.some(ed => ed.id === e.id)));
  }, []);

  const onNodesChange = useCallback((changes: any[]) => {
    setNodes(prev => {
      let updated = [...prev];
      changes.forEach((change: any) => {
        if (change.type === 'position' && change.position) {
          updated = updated.map(node =>
            node.id === change.id ? { ...node, position: change.position } : node
          );
        } else if (change.type === 'remove') {
          updated = updated.filter(node => node.id !== change.id);
        }
      });
      return updated;
    });
  }, []);

  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];
    
    const triggerNodes = nodes.filter(n => n.data.nodeType === 'trigger');
    if (triggerNodes.length === 0) {
      warnings.push('Workflow needs at least one trigger node');
    } else if (triggerNodes.length > 1) {
      warnings.push('Workflow can only have one trigger node');
    }

    const responseNodes = nodes.filter(n => n.data.nodeType === 'response');
    if (responseNodes.length === 0 && nodes.length > 0) {
      warnings.push('Workflow should have at least one response node');
    }

    return warnings;
  }, [nodes]);

  return {
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
    setEdges
  };
}
