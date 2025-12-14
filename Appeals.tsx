import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./queryClient";
import { FileCheck, CheckCircle, XCircle, Clock, User } from "lucide-react";

interface Appeal {
  id: number;
  userId: number;
  guildId: number;
  appealReason: string;
  banReason: string | null;
  status: 'pending' | 'approved' | 'denied';
  reviewedBy: number | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  user?: {
    username: string;
    discriminator: string;
  };
}

interface AppealSettings {
  enabled: boolean;
  allowDmSubmissions: boolean;
  submissionChannelId: string | null;
  staffRoleId: string | null;
}

interface AppealsPageProps {
  useGuild: () => { selectedGuildId: string | null };
  useUnsavedChanges: () => {
    setHasUnsavedChanges: (value: boolean) => void;
    setSaveCallback: (callback: (() => Promise<void>) | null) => void;
    setOriginalData: (data: any) => void;
  };
}

function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Changes",
  message = "Are you sure you want to save these changes?",
  confirmText = "Save Changes",
  cancelText = "Cancel"
}: { 
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4 dark:text-white">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            data-testid="button-cancel-confirmation"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            data-testid="button-confirm-save"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppealDetailModal({
  isOpen,
  onClose,
  appeal,
  onApprove,
  onDeny,
  isPending
}: {
  isOpen: boolean;
  onClose: () => void;
  appeal: Appeal | null;
  onApprove: (reviewNotes: string) => void;
  onDeny: (reviewNotes: string) => void;
  isPending: boolean;
}) {
  const [reviewNotes, setReviewNotes] = useState("");
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDenyConfirm, setShowDenyConfirm] = useState(false);

  useEffect(() => {
    if (appeal) {
      setReviewNotes(appeal.reviewNotes || "");
    }
  }, [appeal]);

  if (!isOpen || !appeal) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: <Clock size={16} /> },
      approved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: <CheckCircle size={16} /> },
      denied: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: <XCircle size={16} /> },
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        {badge.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="modal-appeal-detail">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-2xl font-bold dark:text-white mb-2">Appeal Details</h3>
              {getStatusBadge(appeal.status)}
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
              data-testid="button-close-appeal-modal"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">User</h4>
              <div className="flex items-center gap-2">
                <User size={20} className="text-gray-600 dark:text-gray-400" />
                <p className="dark:text-white" data-testid="text-appeal-user">
                  {appeal.user ? `${appeal.user.username}#${appeal.user.discriminator}` : `User ID: ${appeal.userId}`}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">Ban Reason</h4>
              <p className="dark:text-white" data-testid="text-appeal-ban-reason">
                {appeal.banReason || "No reason provided"}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">Appeal Reason</h4>
              <p className="dark:text-white whitespace-pre-wrap" data-testid="text-appeal-reason">
                {appeal.appealReason}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">Submitted</h4>
                <p className="dark:text-white text-sm">{formatDate(appeal.createdAt)}</p>
              </div>
              {appeal.decidedAt && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">Decided</h4>
                  <p className="dark:text-white text-sm">{formatDate(appeal.decidedAt)}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 dark:text-white">
                Review Notes {appeal.status === 'pending' && <span className="text-gray-500">(Optional)</span>}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                disabled={appeal.status !== 'pending'}
                className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded min-h-[100px] disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={appeal.status === 'pending' ? "Add notes about your decision..." : ""}
                data-testid="textarea-review-notes"
              />
            </div>

            {appeal.status === 'pending' && (
              <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  onClick={() => setShowApproveConfirm(true)}
                  disabled={isPending}
                  className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  data-testid="button-approve-appeal"
                >
                  {isPending ? 'Processing...' : 'Approve Appeal'}
                </button>
                <button
                  onClick={() => setShowDenyConfirm(true)}
                  disabled={isPending}
                  className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  data-testid="button-deny-appeal"
                >
                  {isPending ? 'Processing...' : 'Deny Appeal'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={() => {
          onApprove(reviewNotes);
          setShowApproveConfirm(false);
        }}
        title="Approve Appeal"
        message="Are you sure you want to approve this appeal? This will unban the user."
        confirmText="Approve"
      />

      <ConfirmationModal
        isOpen={showDenyConfirm}
        onClose={() => setShowDenyConfirm(false)}
        onConfirm={() => {
          onDeny(reviewNotes);
          setShowDenyConfirm(false);
        }}
        title="Deny Appeal"
        message="Are you sure you want to deny this appeal?"
        confirmText="Deny"
      />
    </>
  );
}

export default function AppealsPage({
  useGuild: propUseGuild,
  useUnsavedChanges: propUseUnsavedChanges
}: Partial<AppealsPageProps> = {}) {
  // Support both passed props and imported hooks for flexibility
  const guildHook = propUseGuild?.() || { selectedGuildId: null };
  const { selectedGuildId } = guildHook;

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<AppealSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [appealModalOpen, setAppealModalOpen] = useState(false);

  // Unsaved changes integration (if provided)
  const unsavedChangesHook = propUseUnsavedChanges?.();

  const { data: settings, isLoading: settingsLoading } = useQuery<AppealSettings>({
    queryKey: [`/api/guilds/${selectedGuildId}/appeals/settings`],
    enabled: !!selectedGuildId,
  });

  const { data: appeals = [], isLoading: appealsLoading } = useQuery<Appeal[]>({
    queryKey: [`/api/guilds/${selectedGuildId}/appeals`, selectedTab !== 'all' ? selectedTab : null],
    enabled: !!selectedGuildId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<AppealSettings>) => 
      apiRequest(`/api/guilds/${selectedGuildId}/appeals/settings`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/appeals/settings`] });
      setHasChanges(false);
      unsavedChangesHook?.setHasUnsavedChanges(false);
    },
  });

  const reviewAppealMutation = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: number; status: 'approved' | 'denied'; reviewNotes: string }) =>
      apiRequest(`/api/guilds/${selectedGuildId}/appeals/${id}`, "PATCH", {
        status,
        reviewNotes,
        reviewedBy: 1 // This should be the actual user ID in production
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/appeals`] });
      setAppealModalOpen(false);
      setSelectedAppeal(null);
    },
  });

  // Register save callback
  useEffect(() => {
    if (unsavedChangesHook) {
      const saveFunction = async () => {
        return new Promise<void>((resolve, reject) => {
          updateSettingsMutation.mutate(formData, {
            onSuccess: () => {
              setFormData({});
              resolve();
            },
            onError: (error) => {
              reject(error);
            }
          });
        });
      };
      unsavedChangesHook.setSaveCallback(saveFunction);
    }
  }, [formData, updateSettingsMutation, unsavedChangesHook]);

  // Store original data on load
  useEffect(() => {
    if (settings && unsavedChangesHook) {
      unsavedChangesHook.setOriginalData(settings);
    }
  }, [settings, unsavedChangesHook]);

  // Sync hasChanges with global state
  useEffect(() => {
    unsavedChangesHook?.setHasUnsavedChanges(hasChanges);
  }, [hasChanges, unsavedChangesHook]);

  const handleFieldChange = (field: keyof AppealSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setConfirmModalOpen(true);
  };

  const confirmUpdate = () => {
    updateSettingsMutation.mutate(formData);
    setFormData({});
  };

  const handleViewAppeal = (appeal: Appeal) => {
    setSelectedAppeal(appeal);
    setAppealModalOpen(true);
  };

  const handleApproveAppeal = (reviewNotes: string) => {
    if (selectedAppeal) {
      reviewAppealMutation.mutate({
        id: selectedAppeal.id,
        status: 'approved',
        reviewNotes
      });
    }
  };

  const handleDenyAppeal = (reviewNotes: string) => {
    if (selectedAppeal) {
      reviewAppealMutation.mutate({
        id: selectedAppeal.id,
        status: 'denied',
        reviewNotes
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: <Clock size={14} /> },
      approved: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: <CheckCircle size={14} /> },
      denied: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: <XCircle size={14} /> },
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`} data-testid={`badge-status-${status}`}>
        {badge.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredAppeals = selectedTab === 'all' 
    ? appeals 
    : appeals.filter(appeal => appeal.status === selectedTab);

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  if (settingsLoading) {
    return <div className="dark:text-white">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-appeals">
        <FileCheck className="inline-block mr-2 mb-1" size={32} />
        Appeals Management
      </h1>
      
      {/* Settings Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">Appeals Module</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Allow users to appeal their bans</p>
          </div>
          <input
            type="checkbox"
            checked={formData.enabled !== undefined ? formData.enabled : (settings?.enabled !== false)}
            onChange={(e) => handleFieldChange("enabled", e.target.checked)}
            className="w-5 h-5 cursor-pointer"
            data-testid="toggle-enable-appeals"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium dark:text-white">Allow DM Submissions</label>
              <p className="text-xs text-gray-600 dark:text-gray-400">Users can submit appeals via DM to the bot</p>
            </div>
            <input
              type="checkbox"
              checked={formData.allowDmSubmissions !== undefined ? formData.allowDmSubmissions : (settings?.allowDmSubmissions !== false)}
              onChange={(e) => handleFieldChange("allowDmSubmissions", e.target.checked)}
              className="w-5 h-5 cursor-pointer"
              data-testid="checkbox-allow-dm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Submission Channel ID (Optional)</label>
            <input
              type="text"
              value={formData.submissionChannelId !== undefined ? (formData.submissionChannelId || '') : (settings?.submissionChannelId || '')}
              onChange={(e) => handleFieldChange("submissionChannelId", e.target.value || null)}
              placeholder="e.g., 1234567890123456789"
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
              data-testid="input-submission-channel"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Channel where appeal submissions will be posted</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Staff Role ID (Optional)</label>
            <input
              type="text"
              value={formData.staffRoleId !== undefined ? (formData.staffRoleId || '') : (settings?.staffRoleId || '')}
              onChange={(e) => handleFieldChange("staffRoleId", e.target.value || null)}
              placeholder="e.g., 1234567890123456789"
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
              data-testid="input-staff-role"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Role that can review appeals</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateSettingsMutation.isPending}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-save-appeal-settings"
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          {hasChanges && (
            <button
              onClick={() => { setFormData({}); setHasChanges(false); }}
              className="px-6 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              data-testid="button-cancel-appeal-settings"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Appeals List Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Appeals</h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b dark:border-gray-700">
          <button
            onClick={() => setSelectedTab('all')}
            className={`px-4 py-2 font-medium transition -mb-px ${
              selectedTab === 'all'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
            data-testid="tab-all-appeals"
          >
            All
          </button>
          <button
            onClick={() => setSelectedTab('pending')}
            className={`px-4 py-2 font-medium transition -mb-px ${
              selectedTab === 'pending'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
            data-testid="tab-pending-appeals"
          >
            Pending
          </button>
          <button
            onClick={() => setSelectedTab('approved')}
            className={`px-4 py-2 font-medium transition -mb-px ${
              selectedTab === 'approved'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
            data-testid="tab-approved-appeals"
          >
            Approved
          </button>
          <button
            onClick={() => setSelectedTab('denied')}
            className={`px-4 py-2 font-medium transition -mb-px ${
              selectedTab === 'denied'
                ? 'border-b-2 border-blue-500 text-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
            data-testid="tab-denied-appeals"
          >
            Denied
          </button>
        </div>

        {/* Appeals Content */}
        {appealsLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">Loading appeals...</p>
          </div>
        ) : filteredAppeals.length === 0 ? (
          <div className="text-center py-12" data-testid="empty-appeals">
            <FileCheck size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {selectedTab === 'all' ? 'No appeals submitted yet' : `No ${selectedTab} appeals`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredAppeals.map((appeal) => (
              <div
                key={appeal.id}
                className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
                data-testid={`card-appeal-${appeal.id}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <User size={20} className="text-gray-600 dark:text-gray-400" />
                    <div>
                      <p className="font-medium dark:text-white">
                        {appeal.user ? `${appeal.user.username}#${appeal.user.discriminator}` : `User ID: ${appeal.userId}`}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Submitted {formatDate(appeal.createdAt)}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(appeal.status)}
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Ban Reason:</p>
                    <p className="text-sm dark:text-white">{appeal.banReason || "No reason provided"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Appeal Reason:</p>
                    <p className="text-sm dark:text-white line-clamp-2">{appeal.appealReason}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleViewAppeal(appeal)}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm font-medium"
                  data-testid={`button-view-appeal-${appeal.id}`}
                >
                  {appeal.status === 'pending' ? 'Review Appeal' : 'View Details'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmUpdate}
        message="Are you sure you want to save these appeal settings?"
      />

      <AppealDetailModal
        isOpen={appealModalOpen}
        onClose={() => {
          setAppealModalOpen(false);
          setSelectedAppeal(null);
        }}
        appeal={selectedAppeal}
        onApprove={handleApproveAppeal}
        onDeny={handleDenyAppeal}
        isPending={reviewAppealMutation.isPending}
      />
    </div>
  );
}
