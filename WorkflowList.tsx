import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Plus, Zap, Clock, ToggleLeft, ToggleRight, Trash2, Edit, Sparkles } from 'lucide-react';
import { apiRequest, queryClient } from '@/queryClient';
import type { Workflow } from '@shared/schema';

export default function WorkflowListPage() {
  const [guildId] = useState(1);

  const { data: workflows, isLoading } = useQuery<(Workflow & { nodeCount?: number })[]>({
    queryKey: ['/api/workflows', { guildId }],
  });

  const deleteMutation = useMutation({
    mutationFn: (workflowId: number) => apiRequest(`/api/workflows/${workflowId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiRequest(`/api/workflows/${id}`, 'PATCH', { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
    },
  });

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggle = (id: number, currentEnabled: boolean) => {
    toggleMutation.mutate({ id, enabled: !currentEnabled });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-lg dark:text-white">Loading workflows...</div>
        </div>
      </div>
    );
  }

  const hasWorkflows = workflows && workflows.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Workflows</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create custom Discord commands with visual workflows
            </p>
          </div>
          <Link href="/workflows/new">
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              data-testid="button-create-workflow"
            >
              <Plus size={20} />
              Create New Workflow
            </button>
          </Link>
        </div>

        {!hasWorkflows ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="flex justify-center mb-4">
              <Sparkles className="w-16 h-16 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2 dark:text-white">No Workflows Yet</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Create your first workflow to build custom Discord commands with a visual drag-and-drop interface.
            </p>
            <Link href="/workflows/new">
              <button
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-lg font-semibold"
                data-testid="button-create-first-workflow"
              >
                <Plus size={24} />
                Create Your First Workflow
              </button>
            </Link>
            <div className="mt-8 text-sm text-gray-500 dark:text-gray-500">
              💡 Workflows let you create commands like /welcome, !ping, and more without coding
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition"
                data-testid={`card-workflow-${workflow.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold dark:text-white mb-1" data-testid={`text-workflow-name-${workflow.id}`}>
                      {workflow.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Zap size={14} />
                      <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {workflow.commandType === 'slash' ? '/' : '!'}
                        {workflow.commandName}
                      </code>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(workflow.id, workflow.enabled)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title={workflow.enabled ? 'Disable workflow' : 'Enable workflow'}
                    data-testid={`button-toggle-${workflow.id}`}
                  >
                    {workflow.enabled ? (
                      <ToggleRight className="text-green-500" size={24} />
                    ) : (
                      <ToggleLeft className="text-gray-400" size={24} />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <Clock size={12} />
                  <span>
                    Updated {new Date(workflow.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/workflows/${workflow.id}`} className="flex-1">
                    <button
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm"
                      data-testid={`button-edit-${workflow.id}`}
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(workflow.id, workflow.name)}
                    className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
                    data-testid={`button-delete-${workflow.id}`}
                    title="Delete workflow"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
