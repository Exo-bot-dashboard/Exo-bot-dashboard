// Graph validation for workflow builder
import type { WorkflowNodeData } from "@shared/schema";

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateWorkflowGraph(
  nodes: Array<{ nodeType: string; nodeData: WorkflowNodeData; id?: string }>
): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Build node ID map for quick lookup
  const nodeMap = new Map<string, typeof nodes[0]>();
  const nodeIds = new Set<string>();
  
  nodes.forEach((node, index) => {
    const nodeId = node.id || `node-${index}`;
    nodeIds.add(nodeId);
    nodeMap.set(nodeId, node);
  });
  
  // 1. Check for at least one trigger node
  const triggerNodes = nodes.filter(n => n.nodeType === 'trigger');
  if (triggerNodes.length === 0) {
    errors.push({
      code: 'MISSING_TRIGGER',
      message: 'Workflow must have at least one trigger node'
    });
  }
  
  if (triggerNodes.length > 1) {
    errors.push({
      code: 'MULTIPLE_TRIGGERS',
      message: 'Workflow can only have one trigger node'
    });
  }
  
  // 2. Validate edges reference valid nodes and ports
  nodes.forEach((node, index) => {
    const nodeId = node.id || `node-${index}`;
    const edges = node.nodeData.edges || {};
    
    Object.entries(edges).forEach(([outputPortId, edgeList]) => {
      // Check if output port exists
      const outputPort = node.nodeData.ports.outputs.find(p => p.id === outputPortId);
      if (!outputPort) {
        errors.push({
          code: 'INVALID_OUTPUT_PORT',
          message: `Output port '${outputPortId}' does not exist on node`,
          nodeId,
          field: 'edges'
        });
      }
      
      // Check each edge
      edgeList.forEach((edge, edgeIndex) => {
        // Validate target node exists
        if (!nodeIds.has(edge.targetNodeId)) {
          errors.push({
            code: 'INVALID_TARGET_NODE',
            message: `Edge references non-existent node '${edge.targetNodeId}'`,
            nodeId,
            field: `edges.${outputPortId}[${edgeIndex}]`
          });
          return;
        }
        
        // Validate target port exists
        const targetNode = nodeMap.get(edge.targetNodeId);
        if (targetNode) {
          const targetPort = targetNode.nodeData.ports.inputs.find(p => p.id === edge.targetPortId);
          if (!targetPort) {
            errors.push({
              code: 'INVALID_TARGET_PORT',
              message: `Target port '${edge.targetPortId}' does not exist on target node`,
              nodeId,
              field: `edges.${outputPortId}[${edgeIndex}]`
            });
          }
        }
      });
    });
  });
  
  // 3. Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true; // Cycle detected
    }
    if (visited.has(nodeId)) {
      return false; // Already processed
    }
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const node = nodeMap.get(nodeId);
    if (node) {
      const edges = node.nodeData.edges || {};
      for (const edgeList of Object.values(edges)) {
        for (const edge of edgeList) {
          if (hasCycle(edge.targetNodeId)) {
            return true;
          }
        }
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }
  
  // Check for cycles starting from each unvisited node
  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) {
        errors.push({
          code: 'CYCLE_DETECTED',
          message: 'Workflow contains a cycle, which would cause infinite loops'
        });
        break; // Only report once
      }
    }
  }
  
  // 4. Check for disconnected nodes (except trigger)
  const reachableFromTrigger = new Set<string>();
  
  function markReachable(nodeId: string) {
    if (reachableFromTrigger.has(nodeId)) return;
    reachableFromTrigger.add(nodeId);
    
    const node = nodeMap.get(nodeId);
    if (node) {
      const edges = node.nodeData.edges || {};
      for (const edgeList of Object.values(edges)) {
        for (const edge of edgeList) {
          markReachable(edge.targetNodeId);
        }
      }
    }
  }
  
  // Start from trigger node
  triggerNodes.forEach((trigger, index) => {
    const triggerId = trigger.id || `node-${nodes.indexOf(trigger)}`;
    markReachable(triggerId);
  });
  
  // Check if all nodes are reachable
  nodeIds.forEach(nodeId => {
    const node = nodeMap.get(nodeId);
    if (node && node.nodeType !== 'trigger' && !reachableFromTrigger.has(nodeId)) {
      errors.push({
        code: 'DISCONNECTED_NODE',
        message: 'Node is not connected to the workflow execution path',
        nodeId
      });
    }
  });
  
  // 5. Check that all execution paths lead to a response or end
  const responseNodes = nodes.filter(n => n.nodeType === 'response');
  if (responseNodes.length === 0 && nodes.length > 1) {
    errors.push({
      code: 'NO_RESPONSE',
      message: 'Workflow must have at least one response node to send output'
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
