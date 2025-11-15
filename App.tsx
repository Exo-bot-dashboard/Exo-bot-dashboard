import { Route, Switch, Link, useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "./lib/queryClient";
import { useState, useEffect, createContext, useContext } from "react";
import { Settings, DollarSign, Package, Gift, Hammer, Mail, Shield, Lock, FileText, Bot, Users, Home, Menu, X, Moon, Sun, HelpCircle, Box, Smile, Star, MessageSquare, BarChart, ArrowLeftRight, Workflow, FileCheck } from "lucide-react";
import WorkflowBuilderPage from "./pages/WorkflowBuilder";
import WorkflowListPage from "./pages/WorkflowList";
import AppealsPage from "./pages/Appeals";

// Theme Context
const ThemeContext = createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({
  theme: 'dark',
  toggleTheme: () => {},
});

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check if we've migrated to the new default
    const migrated = localStorage.getItem('exo-theme-migrated');
    if (!migrated) {
      // First time or migration needed - set to dark as new default
      localStorage.setItem('exo-theme-migrated', 'true');
      localStorage.setItem('exo-theme', 'dark');
      return 'dark';
    }
    // After migration, respect user's saved preference
    const saved = localStorage.getItem('exo-theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('exo-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  return useContext(ThemeContext);
}

// Confirmation Modal Component
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

// Unsaved Changes Warning Modal
function UnsavedChangesModal({
  isOpen,
  onSave,
  onDiscard,
  onCancel
}: {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4 dark:text-white">Unsaved Changes</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You have unsaved changes. What would you like to do?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onSave}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            data-testid="button-save-changes"
          >
            Save Changes
          </button>
          <button
            onClick={onDiscard}
            className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            data-testid="button-discard-changes"
          >
            Discard Changes
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            data-testid="button-cancel-navigation"
          >
            Stay on This Page
          </button>
        </div>
      </div>
    </div>
  );
}

// Guild Context for sharing selected guild across all pages
const GuildContext = createContext<{
  selectedGuildId: string | null;
  setSelectedGuildId: (id: string) => void;
}>({ selectedGuildId: null, setSelectedGuildId: () => {} });

function GuildProvider({ children }: { children: React.ReactNode}) {
  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(() => {
    // Hydrate from localStorage on mount
    const saved = localStorage.getItem('exo-selected-guild');
    return saved || null;
  });

  const setGuildId = (id: string) => {
    setSelectedGuildId(id);
    localStorage.setItem('exo-selected-guild', id);
    // Invalidate all guild-scoped queries when guild changes
    queryClient.invalidateQueries();
  };

  return (
    <GuildContext.Provider value={{ selectedGuildId, setSelectedGuildId: setGuildId }}>
      {children}
    </GuildContext.Provider>
  );
}

function useGuild() {
  return useContext(GuildContext);
}

// Unsaved Changes Context for tracking form modifications
const UnsavedChangesContext = createContext<{
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  pendingNavigation: string | null;
  setPendingNavigation: (path: string | null) => void;
  originalData: any;
  setOriginalData: (data: any) => void;
  saveCallback: (() => Promise<void>) | null;
  setSaveCallback: (callback: (() => Promise<void>) | null) => void;
}>({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
  pendingNavigation: null,
  setPendingNavigation: () => {},
  originalData: null,
  setOriginalData: () => {},
  saveCallback: null,
  setSaveCallback: () => {},
});

function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  const [saveCallback, setSaveCallback] = useState<(() => Promise<void>) | null>(null);

  return (
    <UnsavedChangesContext.Provider 
      value={{ 
        hasUnsavedChanges, 
        setHasUnsavedChanges,
        pendingNavigation,
        setPendingNavigation,
        originalData,
        setOriginalData,
        saveCallback,
        setSaveCallback
      }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
}

function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}

// React Query hooks for guild data
function useGuildRoles(guildId: string | null) {
  return useQuery<{ id: string; name: string; color: number; position: number }[]>({
    queryKey: ['/api/guilds', guildId, 'roles'],
    queryFn: async () => {
      const response = await fetch(`/api/guilds/${guildId}/roles`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch roles');
      return response.json();
    },
    enabled: !!guildId,
    staleTime: 60000, // 1 minute
    cacheTime: 120000, // 2 minutes
  });
}

function useGuildChannels(guildId: string | null, type?: number) {
  return useQuery<{ id: string; name: string; type: number }[]>({
    queryKey: ['/api/guilds', guildId, 'channels', type],
    queryFn: async () => {
      const url = type !== undefined 
        ? `/api/guilds/${guildId}/channels?type=${type}`
        : `/api/guilds/${guildId}/channels`;
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch channels');
      return response.json();
    },
    enabled: !!guildId,
    staleTime: 60000, // 1 minute
    cacheTime: 120000, // 2 minutes
  });
}

// Role Selector Component
function RoleSelector({ 
  value, 
  onChange, 
  guildId,
  placeholder = "Select a role...",
  allowNone = false,
  disabled = false,
  dataTestId = "select-role"
}: { 
  value: string; 
  onChange: (value: string) => void; 
  guildId: string | null;
  placeholder?: string;
  allowNone?: boolean;
  disabled?: boolean;
  dataTestId?: string;
}) {
  const { data: roles, isLoading, error } = useGuildRoles(guildId);

  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        Failed to load roles. Please refresh or check bot permissions.
      </div>
    );
  }

  if (isLoading) {
    return (
      <select 
        disabled 
        className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        data-testid={dataTestId}
      >
        <option>Loading roles...</option>
      </select>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !guildId}
      className="w-full p-2 border rounded bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
      data-testid={dataTestId}
    >
      <option value="">{placeholder}</option>
      {allowNone && <option value="none">None</option>}
      {roles?.map(role => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </select>
  );
}

// Channel Selector Component
function ChannelSelector({ 
  value, 
  onChange, 
  guildId,
  channelType,
  placeholder = "Select a channel...",
  allowNone = false,
  disabled = false,
  dataTestId = "select-channel"
}: { 
  value: string; 
  onChange: (value: string) => void; 
  guildId: string | null;
  channelType?: number; // 0=text, 2=voice, 4=category
  placeholder?: string;
  allowNone?: boolean;
  disabled?: boolean;
  dataTestId?: string;
}) {
  const { data: channels, isLoading, error } = useGuildChannels(guildId, channelType);

  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        Failed to load channels. Please refresh or check bot permissions.
      </div>
    );
  }

  if (isLoading) {
    return (
      <select 
        disabled 
        className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        data-testid={dataTestId}
      >
        <option>Loading channels...</option>
      </select>
    );
  }

  const getChannelTypeIcon = (type: number) => {
    switch (type) {
      case 0: return '#'; // Text channel
      case 2: return '🔊'; // Voice channel
      case 4: return '📁'; // Category
      default: return '';
    }
  };

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !guildId}
      className="w-full p-2 border rounded bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
      data-testid={dataTestId}
    >
      <option value="">{placeholder}</option>
      {allowNone && <option value="none">None</option>}
      {channels?.map(channel => (
        <option key={channel.id} value={channel.id}>
          {getChannelTypeIcon(channel.type)} {channel.name}
        </option>
      ))}
    </select>
  );
}

// Multi Role Selector Component
function MultiRoleSelector({ 
  value, 
  onChange, 
  guildId,
  placeholder = "Select roles...",
  disabled = false,
  dataTestId = "select-multi-role"
}: { 
  value: string[]; 
  onChange: (value: string[]) => void; 
  guildId: string | null;
  placeholder?: string;
  disabled?: boolean;
  dataTestId?: string;
}) {
  const { data: roles, isLoading, error } = useGuildRoles(guildId);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(value || []);

  useEffect(() => {
    setSelectedRoles(value || []);
  }, [value]);

  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        Failed to load roles. Please refresh or check bot permissions.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
        Loading roles...
      </div>
    );
  }

  const handleToggleRole = (roleId: string) => {
    const newSelection = selectedRoles.includes(roleId)
      ? selectedRoles.filter(id => id !== roleId)
      : [...selectedRoles, roleId];
    
    setSelectedRoles(newSelection);
    onChange(newSelection);
  };

  const selectedRoleObjects = roles?.filter(r => selectedRoles.includes(r.id)) || [];

  return (
    <div className="space-y-2">
      {/* Selected roles badges */}
      {selectedRoleObjects.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid={`${dataTestId}-badges`}>
          {selectedRoleObjects.map(role => (
            <span
              key={role.id}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded-full text-sm"
            >
              {role.name}
              <button
                onClick={() => handleToggleRole(role.id)}
                className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                data-testid={`button-remove-role-${role.id}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      
      {/* Role selection dropdown */}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) {
            handleToggleRole(e.target.value);
            e.target.value = ''; // Reset selection
          }
        }}
        disabled={disabled || !guildId}
        className="w-full p-2 border rounded bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        data-testid={dataTestId}
      >
        <option value="">{placeholder}</option>
        {roles?.map(role => (
          <option 
            key={role.id} 
            value={role.id}
            disabled={selectedRoles.includes(role.id)}
          >
            {role.name} {selectedRoles.includes(role.id) ? '✓' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

function AppContent() {
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <ThemeProvider>
      <GuildProvider>
        <UnsavedChangesProvider>
          <AppContent />
        </UnsavedChangesProvider>
      </GuildProvider>
    </ThemeProvider>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 to-cyan-800 relative overflow-hidden">
      {/* Leaf pattern background */}
      <div className="absolute inset-0 opacity-25 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-5 0-10 5-10 15 0 8 5 15 10 15s10-7 10-15c0-10-5-15-10-15zm0 2c3 0 7 3 7 13 0 6-4 12-7 12s-7-6-7-12c0-10 4-13 7-13z' fill='%23ffffff'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px'
      }}></div>
      <div className="container mx-auto px-4 py-16">
        <div className="text-center text-white">
          <h1 className="text-6xl font-bold mb-6">Exo Dashboard</h1>
          <p className="text-2xl mb-12">Manage your all-in-one Discord bot with ease</p>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-lg p-6">
              <DollarSign className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Economy System</h3>
              <p>Complete economy with custom items, shop, mystery boxes with rarity rewards, and crafting recipes</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-lg p-6">
              <Shield className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Moderation</h3>
              <p>Advanced moderation tools with auto-mod and security features</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-lg p-6">
              <Users className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">User Tracking</h3>
              <p>Track when users were last seen with /seen command and activity monitoring</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/api/auth/discord"
              data-testid="button-login"
              className="inline-block bg-white text-teal-600 px-8 py-4 rounded-lg text-xl font-bold hover:bg-gray-100 transition shadow-lg"
            >
              Login with Discord
            </a>
            <a
              href={`https://discord.com/api/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID'}&permissions=8&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="button-add-bot"
              className="inline-block bg-cyan-500 text-white px-8 py-4 rounded-lg text-xl font-bold hover:bg-cyan-600 transition shadow-lg"
            >
              Add to Discord
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card text-card-foreground rounded-lg p-6 max-w-3xl max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()} data-testid="modal-help">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Exo Help & Documentation</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded" data-testid="button-close-help">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5" /> Economy Commands
            </h3>
            <div className="space-y-2 text-sm">
              <p><code className="bg-muted px-2 py-1 rounded">!balance</code> or <code className="bg-muted px-2 py-1 rounded">!bal</code> - Check your balance</p>
              <p><code className="bg-muted px-2 py-1 rounded">!daily</code> - Claim your daily reward</p>
              <p><code className="bg-muted px-2 py-1 rounded">!pay @user amount</code> - Send coins to another user</p>
              <p><code className="bg-muted px-2 py-1 rounded">!shop</code> - View available items in the shop</p>
              <p><code className="bg-muted px-2 py-1 rounded">!buy &lt;item&gt;</code> - Purchase an item from the shop</p>
              <p><code className="bg-muted px-2 py-1 rounded">!inventory</code> or <code className="bg-muted px-2 py-1 rounded">!inv</code> - View your inventory</p>
              <p><code className="bg-muted px-2 py-1 rounded">!open &lt;box&gt;</code> - Open a mystery box</p>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5" /> Moderation Commands
            </h3>
            <div className="space-y-2 text-sm">
              <p><code className="bg-muted px-2 py-1 rounded">!warn @user reason</code> - Warn a user (requires moderator)</p>
              <p><code className="bg-muted px-2 py-1 rounded">!warnings [@user]</code> - View warnings for yourself or another user</p>
              <p><code className="bg-muted px-2 py-1 rounded">!mute @user duration reason</code> - Mute a user (requires moderator)</p>
              <p><code className="bg-muted px-2 py-1 rounded">!kick @user reason</code> - Kick a user (requires moderator)</p>
              <p><code className="bg-muted px-2 py-1 rounded">!ban @user reason</code> - Ban a user (requires moderator)</p>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" /> User Tracking
            </h3>
            <div className="space-y-2 text-sm">
              <p><code className="bg-muted px-2 py-1 rounded">!seen @user</code> - Check when a user was last active</p>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Dashboard Features
            </h3>
            <div className="space-y-2 text-sm">
              <p><strong>Economy:</strong> Configure daily rewards, starting balance, and other economy settings</p>
              <p><strong>Items:</strong> Create and manage custom shop items with prices and descriptions</p>
              <p><strong>Mystery Boxes:</strong> Set up mystery boxes with rewards and rarity tiers</p>
              <p><strong>Crafting:</strong> Create crafting recipes that combine items</p>
              <p><strong>Modmail:</strong> Manage user support tickets and modmail conversations</p>
              <p><strong>Moderation:</strong> View moderation actions and configure auto-moderation</p>
              <p><strong>Security:</strong> Configure anti-raid protection and verification systems</p>
              <p><strong>Logging:</strong> Set up event logging channels</p>
              <p><strong>Custom Commands:</strong> Create custom commands for your server</p>
              <p><strong>Settings:</strong> Adjust bot prefix and general configuration</p>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3">Getting Started</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Select your server from the dropdown in the header</li>
              <li>Configure economy settings and create shop items</li>
              <li>Set up moderation and security features</li>
              <li>Users can start using economy commands in Discord!</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Default to closed on mobile, open on desktop
    return window.innerWidth >= 768;
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { 
    hasUnsavedChanges, 
    setHasUnsavedChanges, 
    pendingNavigation, 
    setPendingNavigation,
    saveCallback
  } = useUnsavedChanges();

  const { data: botStatus } = useQuery<any>({
    queryKey: ["/api/bot/status"],
    refetchInterval: 10000,
  });

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleSaveAndNavigate = async () => {
    if (saveCallback) {
      try {
        await saveCallback();
        setHasUnsavedChanges(false);
        if (pendingNavigation) {
          setLocation(pendingNavigation);
          setPendingNavigation(null);
        }
      } catch (error) {
        // Save failed - keep the modal open and don't navigate
        console.error('Failed to save changes:', error);
        alert('Failed to save changes. Please try again.');
        // Don't clear hasUnsavedChanges or pendingNavigation - keep the modal open
      }
    } else {
      setHasUnsavedChanges(false);
      if (pendingNavigation) {
        setLocation(pendingNavigation);
        setPendingNavigation(null);
      }
    }
  };

  const handleDiscardAndNavigate = () => {
    setHasUnsavedChanges(false);
    if (pendingNavigation) {
      setLocation(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  const handleCancelNavigation = () => {
    setPendingNavigation(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5e6d3] to-[#e6d5f0] dark:from-[#2d1b0e] dark:to-[#3d1d5e]">
      {/* Mobile Overlay */}
      {sidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="overlay-sidebar"
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full bg-gray-900 dark:bg-gray-950 text-white transition-all duration-300 z-50 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } ${sidebarOpen ? 'w-64' : 'md:w-20 w-64'}`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <h2 className="text-xl font-bold">Exo Dashboard</h2>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-toggle-sidebar"
            className="p-2 hover:bg-gray-800 rounded"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="mt-8 overflow-y-auto h-[calc(100vh-180px)] pb-4">
          <NavItem to="/" icon={<Home />} label="Overview" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/economy" icon={<DollarSign />} label="Economy" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/giveaways" icon={<Gift />} label="Giveaways" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/items" icon={<Package />} label="Items" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/boxes" icon={<Gift />} label="Mystery Boxes" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/chests" icon={<Box />} label="Chests" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/crafting" icon={<Hammer />} label="Crafting" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/trades" icon={<ArrowLeftRight />} label="Trades" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/modmail" icon={<Mail />} label="Modmail" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/appeals" icon={<FileCheck />} label="Appeals" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/moderation" icon={<Shield />} label="Moderation" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/security" icon={<Lock />} label="Security" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/logging" icon={<FileText />} label="Logging" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/tracking" icon={<Users />} label="User Tracking" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/welcome" icon={<Smile />} label="Welcome" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/reactions" icon={<Star />} label="Reaction Roles" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/embeds" icon={<MessageSquare />} label="Embeds" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/stats" icon={<BarChart />} label="Statistics" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/commands" icon={<Bot />} label="Custom Commands" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/workflows" icon={<Workflow />} label="Workflows" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
          <NavItem to="/settings" icon={<Settings />} label="Settings" sidebarOpen={sidebarOpen} onClick={() => isMobile && setSidebarOpen(false)} />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-800">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <div className="text-sm">Bot Status</div>
                <div className={`text-xs ${botStatus?.status === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                  {botStatus?.status || 'offline'}
                </div>
              </div>
            )}
            <div className={`w-3 h-3 rounded-full ${botStatus?.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} data-testid="status-bot" />
          </div>
        </div>
      </aside>

      {/* Help Modal */}
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={!!pendingNavigation}
        onSave={handleSaveAndNavigate}
        onDiscard={handleDiscardAndNavigate}
        onCancel={handleCancelNavigation}
      />

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        <header className="bg-card shadow-sm p-4">
          <div className="flex items-center justify-between gap-2">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-accent rounded-lg transition"
              data-testid="button-open-mobile-menu"
            >
              <Menu size={20} />
            </button>
            
            <GuildSelector />
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-accent rounded-lg transition"
                data-testid="button-toggle-theme"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <button
                onClick={() => setHelpOpen(true)}
                className="p-2 hover:bg-accent rounded-lg transition"
                data-testid="button-open-help"
                title="Help & Documentation"
              >
                <HelpCircle size={20} />
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Switch>
            <Route path="/" component={OverviewPage} />
            <Route path="/economy" component={EconomyPage} />
            <Route path="/giveaways" component={GiveawayPage} />
            <Route path="/items" component={ItemsPage} />
            <Route path="/boxes" component={MysteryBoxesPage} />
            <Route path="/chests" component={ChestsPage} />
            <Route path="/crafting" component={CraftingPage} />
            <Route path="/trades" component={TradesPage} />
            <Route path="/modmail" component={ModmailPage} />
            <Route path="/appeals">
              {() => <AppealsPage useGuild={useGuild} useUnsavedChanges={useUnsavedChanges} />}
            </Route>
            <Route path="/moderation" component={ModerationPage} />
            <Route path="/security" component={SecurityPage} />
            <Route path="/logging" component={LoggingPage} />
            <Route path="/tracking" component={UserTrackingPage} />
            <Route path="/welcome" component={WelcomePage} />
            <Route path="/reactions" component={ReactionRolesPage} />
            <Route path="/embeds" component={EmbedsPage} />
            <Route path="/stats" component={StatisticsPage} />
            <Route path="/commands" component={CommandsPage} />
            <Route path="/workflows" component={WorkflowListPage} />
            <Route path="/workflows/new" component={WorkflowBuilderPage} />
            <Route path="/workflows/:id" component={WorkflowBuilderPage} />
            <Route path="/settings" component={SettingsPage} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label, sidebarOpen, onClick }: { to: string; icon: React.ReactNode; label: string; sidebarOpen: boolean; onClick?: () => void }) {
  const [location, setLocation] = useLocation();
  const isActive = location === to;
  const { hasUnsavedChanges, setPendingNavigation } = useUnsavedChanges();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (hasUnsavedChanges && location !== to) {
      e.preventDefault();
      setPendingNavigation(to);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <Link href={to}>
      <a
        onClick={handleClick}
        data-testid={`link-${label.toLowerCase().replace(/\s+/g, '-')}`}
        className={`flex items-center gap-3 px-4 py-3 min-h-[48px] md:min-h-0 hover:bg-gray-800 transition ${
          isActive ? 'bg-gray-800 border-l-4 border-blue-500' : ''
        }`}
      >
        <span className="flex-shrink-0">{icon}</span>
        {sidebarOpen && <span>{label}</span>}
      </a>
    </Link>
  );
}

function GuildSelector() {
  const { selectedGuildId, setSelectedGuildId } = useGuild();
  const { data: guilds } = useQuery<any>({
    queryKey: ["/api/guilds"],
  });

  return (
    <div className="flex items-center justify-between">
      <div>
        <select
          data-testid="select-guild"
          className="px-4 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
          value={selectedGuildId || ""}
          onChange={(e) => setSelectedGuildId(e.target.value)}
        >
          <option value="">Select a Server</option>
          {guilds?.map((guild: any) => (
            <option key={guild.id} value={guild.id}>
              {guild.name}
            </option>
          ))}
        </select>
      </div>

      <button
        data-testid="button-logout"
        onClick={async () => {
          await apiRequest("/api/auth/logout", "POST");
          window.location.reload();
        }}
        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
}

function OverviewPage() {
  const { data: botStatus } = useQuery<any>({
    queryKey: ["/api/bot/status"],
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6" data-testid="heading-overview">Dashboard Overview</h1>
      
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Servers" value={botStatus?.guilds || 0} icon={<Users />} />
        <StatCard title="Users" value={botStatus?.users || 0} icon={<Users />} />
        <StatCard title="Uptime" value={formatUptime(botStatus?.uptime || 0)} icon={<Bot />} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Quick Start</h2>
        <p className="mb-4 dark:text-gray-300">Welcome to your Exo dashboard! Here you can:</p>
        <ul className="list-disc list-inside space-y-2 dark:text-gray-300">
          <li>Configure economy settings and create custom items</li>
          <li>Set up mystery boxes with rarity-based rewards</li>
          <li>Create crafting recipes for your items</li>
          <li>Manage modmail tickets and moderation settings</li>
          <li>Configure security and auto-moderation features</li>
          <li>Create custom commands for your server</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-gray-600 text-sm">{title}</div>
          <div className="text-3xl font-bold mt-1" data-testid={`stat-${title.toLowerCase()}`}>{value}</div>
        </div>
        <div className="text-gray-400">{icon}</div>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Page Components
function EconomyPage() {
  const { selectedGuildId } = useGuild();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { setHasUnsavedChanges, setSaveCallback, setOriginalData } = useUnsavedChanges();
  
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/economy/settings`],
    enabled: !!selectedGuildId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/economy/settings`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/economy/settings`] });
      setHasChanges(false);
      setHasUnsavedChanges(false);
    },
  });

  // Register save callback
  useEffect(() => {
    const saveFunction = async () => {
      return new Promise<void>((resolve, reject) => {
        updateMutation.mutate(formData, {
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
    setSaveCallback(saveFunction);
  }, [formData, updateMutation]);

  // Store original data on load
  useEffect(() => {
    if (settings) {
      setOriginalData(settings);
    }
  }, [settings]);

  // Sync hasChanges with global state
  useEffect(() => {
    setHasUnsavedChanges(hasChanges);
  }, [hasChanges]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setConfirmModalOpen(true);
  };

  const confirmUpdate = () => {
    updateMutation.mutate(formData);
    setFormData({});
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  if (isLoading) return <div className="dark:text-white">Loading...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-economy">Economy Settings</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">Economy Module</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Enable or disable economy features</p>
          </div>
          <input
            type="checkbox"
            checked={formData.enabled !== undefined ? formData.enabled : (settings?.enabled !== false)}
            onChange={(e) => handleFieldChange("enabled", e.target.checked)}
            className="w-5 h-5"
            data-testid="toggle-economy-enabled"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Economy Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Daily Reward Amount</label>
            <input
              type="number"
              value={formData.dailyAmount !== undefined ? formData.dailyAmount : (settings?.dailyAmount || 100)}
              onChange={(e) => handleFieldChange("dailyAmount", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
              data-testid="input-daily-amount"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Weekly Reward Amount</label>
            <input
              type="number"
              value={formData.weeklyAmount !== undefined ? formData.weeklyAmount : (settings?.weeklyAmount || 500)}
              onChange={(e) => handleFieldChange("weeklyAmount", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
              data-testid="input-weekly-amount"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Starting Balance</label>
            <input
              type="number"
              value={formData.startingBalance !== undefined ? formData.startingBalance : (settings?.startingBalance || 100)}
              onChange={(e) => handleFieldChange("startingBalance", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
              data-testid="input-starting-balance"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Maximum Bank Balance</label>
            <input
              type="number"
              value={formData.maxBank !== undefined ? formData.maxBank : (settings?.maxBank || 10000)}
              onChange={(e) => handleFieldChange("maxBank", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
              data-testid="input-max-bank"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-save-economy"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          {hasChanges && (
            <button
              onClick={() => { setFormData({}); setHasChanges(false); }}
              className="px-6 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              data-testid="button-cancel-economy"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmUpdate}
        message="Are you sure you want to save these economy settings?"
      />
    </div>
  );
}

function ItemsPage() {
  const { selectedGuildId } = useGuild();
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const { data: items = [], isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/items`],
    enabled: !!selectedGuildId,
  });

  const createItemMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/items`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/items`] });
      setItemModalOpen(false);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest(`/api/guilds/${selectedGuildId}/items/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/items`] });
      setItemModalOpen(false);
      setEditingItem(null);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/guilds/${selectedGuildId}/items/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/items`] });
    },
  });

  const handleItemSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      price: parseInt(formData.get("price") as string),
      roleId: formData.get("role") || undefined,
      itemType: "collectible",
      isShopItem: true,
    };

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-items">Items Manager</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Shop Items</h2>
          <button
            onClick={() => {
              setEditingItem(null);
              setItemModalOpen(true);
            }}
            data-testid="button-create-item"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Create Item
          </button>
        </div>
        {isLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading items...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No items created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left dark:text-white">Name</th>
                  <th className="px-4 py-2 text-left dark:text-white">Description</th>
                  <th className="px-4 py-2 text-left dark:text-white">Price</th>
                  <th className="px-4 py-2 text-left dark:text-white">Role</th>
                  <th className="px-4 py-2 text-left dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-t dark:border-gray-700">
                    <td className="px-4 py-2 dark:text-white" data-testid={`text-item-name-${item.id}`}>{item.name}</td>
                    <td className="px-4 py-2 dark:text-white">{item.description}</td>
                    <td className="px-4 py-2 dark:text-white">{item.price} coins</td>
                    <td className="px-4 py-2 dark:text-white">{item.roleId || "—"}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setItemModalOpen(true);
                        }}
                        data-testid={`button-edit-item-${item.id}`}
                        className="mr-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirm("Delete this item?") && deleteItemMutation.mutate(item.id)}
                        data-testid={`button-delete-item-${item.id}`}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {itemModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="modal-item">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{editingItem ? "Edit" : "Create"} Item</h3>
            <form onSubmit={handleItemSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingItem?.name || ""}
                  required
                  data-testid="input-item-name"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingItem?.description || ""}
                  required
                  data-testid="input-item-description"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Price (coins)</label>
                <input
                  type="number"
                  name="price"
                  defaultValue={editingItem?.price || "100"}
                  required
                  data-testid="input-item-price"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Role ID (optional)</label>
                <input
                  type="text"
                  name="role"
                  defaultValue={editingItem?.roleId || ""}
                  placeholder="Discord role ID"
                  data-testid="input-item-role"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setItemModalOpen(false);
                    setEditingItem(null);
                  }}
                  data-testid="button-cancel-item"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="button-submit-item"
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  {editingItem ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MysteryBoxesPage() {
  const { selectedGuildId } = useGuild();
  const [boxModalOpen, setBoxModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<any>(null);
  const [rewards, setRewards] = useState<Array<{ reward: string; weight: number }>>([{ reward: "", weight: 100 }]);

  const { data: boxes = [], isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/boxes`],
    enabled: !!selectedGuildId,
  });

  const createBoxMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/boxes`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/boxes`] });
      setBoxModalOpen(false);
      setRewards([{ reward: "", weight: 100 }]);
    },
  });

  const updateBoxMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest(`/api/guilds/${selectedGuildId}/boxes/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/boxes`] });
      setBoxModalOpen(false);
      setEditingBox(null);
      setRewards([{ reward: "", weight: 100 }]);
    },
  });

  const deleteBoxMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/guilds/${selectedGuildId}/boxes/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/boxes`] });
    },
  });

  const handleBoxSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      price: parseInt(formData.get("price") as string) || 0,
      rewards: rewards.filter(r => r.reward && r.weight > 0).map(r => ({
        item: r.reward,
        weight: r.weight
      }))
    };

    if (editingBox) {
      updateBoxMutation.mutate({ id: editingBox.id, data });
    } else {
      createBoxMutation.mutate(data);
    }
  };

  const addReward = () => {
    setRewards([...rewards, { reward: "", weight: 100 }]);
  };

  const removeReward = (index: number) => {
    setRewards(rewards.filter((_, i) => i !== index));
  };

  const updateReward = (index: number, field: 'reward' | 'weight', value: string | number) => {
    const newRewards = [...rewards];
    newRewards[index] = { ...newRewards[index], [field]: value };
    setRewards(newRewards);
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-boxes">Mystery Boxes</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Mystery Boxes</h2>
          <button
            onClick={() => {
              setEditingBox(null);
              setBoxModalOpen(true);
              setRewards([{ reward: "", weight: 100 }]);
            }}
            data-testid="button-create-box"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Create Box
          </button>
        </div>
        {isLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading boxes...</p>
        ) : boxes.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No boxes created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left dark:text-white">Name</th>
                  <th className="px-4 py-2 text-left dark:text-white">Description</th>
                  <th className="px-4 py-2 text-left dark:text-white">Price</th>
                  <th className="px-4 py-2 text-left dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {boxes.map((box: any) => (
                  <tr key={box.id} className="border-t dark:border-gray-700">
                    <td className="px-4 py-2 dark:text-white" data-testid={`text-box-name-${box.id}`}>{box.name}</td>
                    <td className="px-4 py-2 dark:text-white">{box.description}</td>
                    <td className="px-4 py-2 dark:text-white">{box.price} coins</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => {
                          setEditingBox(box);
                          setBoxModalOpen(true);
                        }}
                        data-testid={`button-edit-box-${box.id}`}
                        className="mr-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirm("Delete this box?") && deleteBoxMutation.mutate(box.id)}
                        data-testid={`button-delete-box-${box.id}`}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {boxModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="modal-box">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{editingBox ? "Edit" : "Create"} Mystery Box</h3>
            <form onSubmit={handleBoxSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingBox?.name || ""}
                  required
                  data-testid="input-box-name"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingBox?.description || ""}
                  required
                  data-testid="input-box-description"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Price (coins)</label>
                <input
                  type="number"
                  name="price"
                  defaultValue={editingBox?.price || "100"}
                  required
                  data-testid="input-box-price"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 dark:text-white">Rewards</label>
                {rewards.map((reward, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Item name"
                      value={reward.reward}
                      onChange={(e) => updateReward(index, 'reward', e.target.value)}
                      className="flex-1 px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      data-testid={`input-reward-item-${index}`}
                    />
                    <input
                      type="number"
                      placeholder="Weight"
                      value={reward.weight}
                      onChange={(e) => updateReward(index, 'weight', parseInt(e.target.value) || 0)}
                      className="w-24 px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      data-testid={`input-reward-weight-${index}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeReward(index)}
                      className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      data-testid={`button-remove-reward-${index}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addReward}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  data-testid="button-add-reward"
                >
                  Add Reward
                </button>
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBoxModalOpen(false);
                    setEditingBox(null);
                    setRewards([{ reward: "", weight: 100 }]);
                  }}
                  data-testid="button-cancel-box"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="button-submit-box"
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  {editingBox ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ChestsPage() {
  const { selectedGuildId } = useGuild();
  const [rarityModalOpen, setRarityModalOpen] = useState(false);
  const [chestModalOpen, setChestModalOpen] = useState(false);
  const [editingRarity, setEditingRarity] = useState<any>(null);
  const [editingChest, setEditingChest] = useState<any>(null);

  const { data: rarities = [], isLoading: raritiesLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/chests/rarities`],
    enabled: !!selectedGuildId,
  });

  const { data: chests = [], isLoading: chestsLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/chests`],
    enabled: !!selectedGuildId,
  });

  const createRarityMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/chests/rarities`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/chests/rarities`] });
      setRarityModalOpen(false);
    },
  });

  const updateRarityMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest(`/api/guilds/${selectedGuildId}/chests/rarities/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/chests/rarities`] });
      setRarityModalOpen(false);
      setEditingRarity(null);
    },
  });

  const deleteRarityMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/guilds/${selectedGuildId}/chests/rarities/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/chests/rarities`] });
    },
  });

  const createChestMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/chests`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/chests`] });
      setChestModalOpen(false);
    },
  });

  const updateChestMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest(`/api/guilds/${selectedGuildId}/chests/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/chests`] });
      setChestModalOpen(false);
      setEditingChest(null);
    },
  });

  const deleteChestMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/guilds/${selectedGuildId}/chests/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/chests`] });
    },
  });

  const handleRaritySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      displayName: formData.get("displayName"),
      color: formData.get("color"),
      emoji: formData.get("emoji") || undefined,
      sortOrder: parseInt(formData.get("sortOrder") as string),
    };

    if (editingRarity) {
      updateRarityMutation.mutate({ id: editingRarity.id, data });
    } else {
      createRarityMutation.mutate(data);
    }
  };

  const handleChestSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      price: parseInt(formData.get("price") as string),
    };

    if (editingChest) {
      updateChestMutation.mutate({ id: editingChest.id, data });
    } else {
      createChestMutation.mutate(data);
    }
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-chests">Chests System</h1>
      
      {/* Rarities Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Custom Rarities</h2>
          <button
            onClick={() => {
              setEditingRarity(null);
              setRarityModalOpen(true);
            }}
            data-testid="button-create-rarity"
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Create Rarity
          </button>
        </div>
        {raritiesLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading rarities...</p>
        ) : rarities.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No rarities defined. Create your first rarity tier!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left dark:text-white">Name</th>
                  <th className="px-4 py-2 text-left dark:text-white">Display Name</th>
                  <th className="px-4 py-2 text-left dark:text-white">Color</th>
                  <th className="px-4 py-2 text-left dark:text-white">Sort Order</th>
                  <th className="px-4 py-2 text-left dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rarities.map((rarity: any) => (
                  <tr key={rarity.id} className="border-t dark:border-gray-700">
                    <td className="px-4 py-2 dark:text-white" data-testid={`text-rarity-name-${rarity.id}`}>{rarity.emoji || ""} {rarity.name}</td>
                    <td className="px-4 py-2 dark:text-white">{rarity.displayName}</td>
                    <td className="px-4 py-2 dark:text-white">
                      <span style={{ color: rarity.color }}>{rarity.color}</span>
                    </td>
                    <td className="px-4 py-2 dark:text-white">{rarity.sortOrder}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => {
                          setEditingRarity(rarity);
                          setRarityModalOpen(true);
                        }}
                        data-testid={`button-edit-rarity-${rarity.id}`}
                        className="mr-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirm("Delete this rarity?") && deleteRarityMutation.mutate(rarity.id)}
                        data-testid={`button-delete-rarity-${rarity.id}`}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chests Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Chests</h2>
          <button
            onClick={() => {
              setEditingChest(null);
              setChestModalOpen(true);
            }}
            data-testid="button-create-chest"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Create Chest
          </button>
        </div>
        {chestsLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading chests...</p>
        ) : chests.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No chests created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left dark:text-white">Name</th>
                  <th className="px-4 py-2 text-left dark:text-white">Description</th>
                  <th className="px-4 py-2 text-left dark:text-white">Price</th>
                  <th className="px-4 py-2 text-left dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {chests.map((chest: any) => (
                  <tr key={chest.id} className="border-t dark:border-gray-700">
                    <td className="px-4 py-2 dark:text-white" data-testid={`text-chest-name-${chest.id}`}>{chest.name}</td>
                    <td className="px-4 py-2 dark:text-white">{chest.description}</td>
                    <td className="px-4 py-2 dark:text-white">{chest.price} coins</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => {
                          setEditingChest(chest);
                          setChestModalOpen(true);
                        }}
                        data-testid={`button-edit-chest-${chest.id}`}
                        className="mr-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirm("Delete this chest?") && deleteChestMutation.mutate(chest.id)}
                        data-testid={`button-delete-chest-${chest.id}`}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rarity Modal */}
      {rarityModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{editingRarity ? "Edit" : "Create"} Rarity</h3>
            <form onSubmit={handleRaritySubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingRarity?.name || ""}
                  required
                  placeholder="common"
                  data-testid="input-rarity-name"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Display Name</label>
                <input
                  type="text"
                  name="displayName"
                  defaultValue={editingRarity?.displayName || ""}
                  required
                  placeholder="Common"
                  data-testid="input-rarity-displayname"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Color (hex)</label>
                <input
                  type="text"
                  name="color"
                  defaultValue={editingRarity?.color || "#808080"}
                  placeholder="#808080"
                  data-testid="input-rarity-color"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Emoji (optional)</label>
                <input
                  type="text"
                  name="emoji"
                  defaultValue={editingRarity?.emoji || ""}
                  placeholder="⭐"
                  data-testid="input-rarity-emoji"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Sort Order</label>
                <input
                  type="number"
                  name="sortOrder"
                  defaultValue={editingRarity?.sortOrder || "0"}
                  required
                  data-testid="input-rarity-sortorder"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRarityModalOpen(false);
                    setEditingRarity(null);
                  }}
                  data-testid="button-cancel-rarity"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="button-submit-rarity"
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                >
                  {editingRarity ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chest Modal */}
      {chestModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{editingChest ? "Edit" : "Create"} Chest</h3>
            <form onSubmit={handleChestSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingChest?.name || ""}
                  required
                  data-testid="input-chest-name"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingChest?.description || ""}
                  data-testid="input-chest-description"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Price (coins)</label>
                <input
                  type="number"
                  name="price"
                  defaultValue={editingChest?.price || "100"}
                  required
                  data-testid="input-chest-price"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChestModalOpen(false);
                    setEditingChest(null);
                  }}
                  data-testid="button-cancel-chest"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="button-submit-chest"
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  {editingChest ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CraftingPage() {
  const { selectedGuildId } = useGuild();
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const [ingredients, setIngredients] = useState<Array<{ item: string; quantity: number }>>([{ item: "", quantity: 1 }]);

  const { data: recipes = [], isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/recipes`],
    enabled: !!selectedGuildId,
  });

  const createRecipeMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/recipes`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/recipes`] });
      setRecipeModalOpen(false);
      setIngredients([{ item: "", quantity: 1 }]);
    },
  });

  const updateRecipeMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest(`/api/guilds/${selectedGuildId}/recipes/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/recipes`] });
      setRecipeModalOpen(false);
      setEditingRecipe(null);
      setIngredients([{ item: "", quantity: 1 }]);
    },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/guilds/${selectedGuildId}/recipes/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/recipes`] });
    },
  });

  const handleRecipeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      resultItemId: 1,
      resultQuantity: parseInt(formData.get("resultQuantity") as string) || 1,
      ingredients: ingredients.filter(ing => ing.item && ing.quantity > 0).map(ing => ({
        item: ing.item,
        quantity: ing.quantity
      }))
    };

    if (editingRecipe) {
      updateRecipeMutation.mutate({ id: editingRecipe.id, data });
    } else {
      createRecipeMutation.mutate(data);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { item: "", quantity: 1 }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: 'item' | 'quantity', value: string | number) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-crafting">Crafting Recipes</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Recipes</h2>
          <button
            onClick={() => {
              setEditingRecipe(null);
              setRecipeModalOpen(true);
              setIngredients([{ item: "", quantity: 1 }]);
            }}
            data-testid="button-create-recipe"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Create Recipe
          </button>
        </div>
        {isLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading recipes...</p>
        ) : recipes.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No recipes created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left dark:text-white">Name</th>
                  <th className="px-4 py-2 text-left dark:text-white">Result Item ID</th>
                  <th className="px-4 py-2 text-left dark:text-white">Result Quantity</th>
                  <th className="px-4 py-2 text-left dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe: any) => (
                  <tr key={recipe.id} className="border-t dark:border-gray-700">
                    <td className="px-4 py-2 dark:text-white" data-testid={`text-recipe-name-${recipe.id}`}>{recipe.name}</td>
                    <td className="px-4 py-2 dark:text-white">{recipe.resultItemId}</td>
                    <td className="px-4 py-2 dark:text-white">{recipe.resultQuantity}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => {
                          setEditingRecipe(recipe);
                          setRecipeModalOpen(true);
                        }}
                        data-testid={`button-edit-recipe-${recipe.id}`}
                        className="mr-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => confirm("Delete this recipe?") && deleteRecipeMutation.mutate(recipe.id)}
                        data-testid={`button-delete-recipe-${recipe.id}`}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recipeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="modal-recipe">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{editingRecipe ? "Edit" : "Create"} Recipe</h3>
            <form onSubmit={handleRecipeSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Recipe Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingRecipe?.name || ""}
                  required
                  data-testid="input-recipe-name"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 dark:text-white">Ingredients</label>
                {ingredients.map((ingredient, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Item name"
                      value={ingredient.item}
                      onChange={(e) => updateIngredient(index, 'item', e.target.value)}
                      data-testid={`input-ingredient-item-${index}`}
                      className="flex-1 px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={ingredient.quantity}
                      onChange={(e) => updateIngredient(index, 'quantity', parseInt(e.target.value) || 1)}
                      data-testid={`input-ingredient-quantity-${index}`}
                      className="w-20 px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                    />
                    {ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredient(index)}
                        data-testid={`button-remove-ingredient-${index}`}
                        className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addIngredient}
                  data-testid="button-add-ingredient"
                  className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  + Add Ingredient
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Result Quantity</label>
                <input
                  type="number"
                  name="resultQuantity"
                  defaultValue={editingRecipe?.resultQuantity || "1"}
                  required
                  data-testid="input-recipe-result-quantity"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecipeModalOpen(false);
                    setEditingRecipe(null);
                    setIngredients([{ item: "", quantity: 1 }]);
                  }}
                  data-testid="button-cancel-recipe"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="button-submit-recipe"
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  {editingRecipe ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TradesPage() {
  const { selectedGuildId } = useGuild();

  const { data: trades, isLoading } = useQuery<any[]>({
    queryKey: [`/api/guilds/${selectedGuildId}/trades`],
    enabled: !!selectedGuildId,
  });

  if (!selectedGuildId) {
    return (
      <div className="p-8">
        <p className="text-gray-600 dark:text-gray-400">Please select a server from the overview page.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-trades">Trading System</h1>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-gray-400">Loading trades...</div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2 dark:text-white">Trade History</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage trades made through Discord bot commands (/trade, /accept, /decline).
            </p>
          </div>

          {trades && trades.length > 0 ? (
            <div className="space-y-4">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  data-testid={`trade-item-${trade.id}`}
                  className="border dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium dark:text-white">
                        Trade #{trade.id}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        trade.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        trade.status === 'cancelled' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`} data-testid={`trade-status-${trade.id}`}>
                        {trade.status}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(trade.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Offered Items</h4>
                      <div className="space-y-1">
                        {(trade.offeredItems || []).map((item: any, idx: number) => (
                          <div key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                            Item #{item.itemId} × {item.quantity}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Requested Items</h4>
                      <div className="space-y-1">
                        {(trade.requestedItems || []).map((item: any, idx: number) => (
                          <div key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                            Item #{item.itemId} × {item.quantity}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12" data-testid="no-trades-message">
              <ArrowLeftRight className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No trades yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Players can create trades using the <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/trade</code> command in Discord
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModmailPage() {
  const { selectedGuildId } = useGuild();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { setHasUnsavedChanges, setSaveCallback, setOriginalData } = useUnsavedChanges();
  
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/modmail/settings`],
    enabled: !!selectedGuildId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/modmail/settings`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/modmail/settings`] });
      setHasChanges(false);
      setHasUnsavedChanges(false);
    },
  });

  // Register save callback
  useEffect(() => {
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
    setSaveCallback(saveFunction);
  }, [formData, updateSettingsMutation]);

  // Store original data on load
  useEffect(() => {
    if (settings) {
      setOriginalData(settings);
    }
    return () => {
      setHasUnsavedChanges(false);
      setSaveCallback(null);
      setOriginalData(null);
    };
  }, [settings]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setConfirmModalOpen(true);
  };

  const confirmUpdate = () => {
    updateSettingsMutation.mutate(formData);
    setFormData({});
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-10 dark:text-white">Loading...</div>;
  }

  return (
    <div className="dark:text-white">
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-modmail">Modmail System</h1>
      
      {/* Module Enable/Disable */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold dark:text-white">Module Status</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Enable or disable the entire modmail module</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enabled !== undefined ? formData.enabled : (settings?.enabled || false)}
              onChange={(e) => handleFieldChange("enabled", e.target.checked)}
              className="sr-only peer"
              data-testid="toggle-modmail-enabled"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Basic Features */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Basic Features</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">DM Forwarding</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Forward user DMs to staff channels</p>
            </div>
            <input
              type="checkbox"
              checked={formData.dmForwarding !== undefined ? formData.dmForwarding : (settings?.dmForwarding || false)}
              onChange={(e) => handleFieldChange("dmForwarding", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-dm-forwarding"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Auto Response</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Send automatic response when ticket is created</p>
            </div>
            <input
              type="checkbox"
              checked={formData.autoResponse !== undefined ? formData.autoResponse : (settings?.autoResponse || false)}
              onChange={(e) => handleFieldChange("autoResponse", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-auto-response"
            />
          </div>
        </div>
      </div>

      {/* Advanced Features */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Advanced Features</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Anonymous Replies</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Staff replies appear as the bot instead of their username</p>
            </div>
            <input
              type="checkbox"
              checked={formData.anonymousReplies !== undefined ? formData.anonymousReplies : (settings?.anonymousReplies || false)}
              onChange={(e) => handleFieldChange("anonymousReplies", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-anonymous-replies"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Transcript Logging</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Save full ticket transcripts when closed</p>
            </div>
            <input
              type="checkbox"
              checked={formData.transcriptLogging !== undefined ? formData.transcriptLogging : (settings?.transcriptLogging || false)}
              onChange={(e) => handleFieldChange("transcriptLogging", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-transcript-logging"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Ticket Ratings</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Allow users to rate support experience</p>
            </div>
            <input
              type="checkbox"
              checked={formData.ticketRatings !== undefined ? formData.ticketRatings : (settings?.ticketRatings || false)}
              onChange={(e) => handleFieldChange("ticketRatings", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-ticket-ratings"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Auto-Close Inactive Tickets</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Automatically close tickets after inactivity period</p>
            </div>
            <input
              type="checkbox"
              checked={formData.autoCloseInactive !== undefined ? formData.autoCloseInactive : (settings?.autoCloseInactive || false)}
              onChange={(e) => handleFieldChange("autoCloseInactive", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-auto-close"
            />
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Ticket Category</label>
            <ChannelSelector
              value={formData.categoryId !== undefined ? formData.categoryId : (settings?.categoryId || "")}
              onChange={(value) => handleFieldChange("categoryId", value)}
              guildId={selectedGuildId}
              channelType={4}
              placeholder="Select a category for tickets..."
              allowNone={true}
              dataTestId="select-category-id"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ticket channels will be created in this category</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Staff Role</label>
            <RoleSelector
              value={formData.staffRoleId !== undefined ? formData.staffRoleId : (settings?.staffRoleId || "")}
              onChange={(value) => handleFieldChange("staffRoleId", value)}
              guildId={selectedGuildId}
              placeholder="Select staff role..."
              allowNone={true}
              dataTestId="select-staff-role"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Members with this role can manage tickets</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Inactivity Timeout (hours)</label>
            <input
              type="number"
              value={formData.inactiveTimeout !== undefined ? formData.inactiveTimeout : (settings?.inactiveTimeout || 24)}
              onChange={(e) => handleFieldChange("inactiveTimeout", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
              data-testid="input-inactive-timeout"
            />
          </div>
        </div>
      </div>

      {/* Save/Cancel Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || updateSettingsMutation.isPending}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-save-modmail"
        >
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        {hasChanges && (
          <button
            onClick={() => { setFormData({}); setHasChanges(false); }}
            className="px-6 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
            data-testid="button-cancel-modmail"
          >
            Cancel
          </button>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmUpdate}
        message="Are you sure you want to save these modmail settings?"
      />
    </div>
  );
}

function ShadowbanSection({ selectedGuildId }: { selectedGuildId: string | null }) {
  const [newShadowbanUserId, setNewShadowbanUserId] = useState("");
  const [newShadowbanReason, setNewShadowbanReason] = useState("");

  const { data: shadowbans, isLoading } = useQuery<any[]>({
    queryKey: [`/api/guilds/${selectedGuildId}/shadowbans`],
    enabled: !!selectedGuildId,
  });

  const createShadowbanMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/shadowbans`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/shadowbans`] });
      setNewShadowbanUserId("");
      setNewShadowbanReason("");
    },
  });

  const deleteShadowbanMutation = useMutation({
    mutationFn: (shadowbanId: number) => apiRequest(`/api/guilds/${selectedGuildId}/shadowbans/${shadowbanId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/shadowbans`] });
    },
  });

  const handleAddShadowban = () => {
    if (!newShadowbanUserId.trim()) return;
    // Send Discord ID as a string (Discord snowflakes exceed JavaScript's safe integer range)
    createShadowbanMutation.mutate({
      discordId: newShadowbanUserId.trim(),
      reason: newShadowbanReason || "No reason provided",
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 dark:text-white">Shadowban Management</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Shadowbanned users can send messages, but they're invisible to everyone except moderators.
      </p>

      {/* Add New Shadowban */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded p-4 mb-4">
        <h3 className="font-medium mb-3 dark:text-white">Add Shadowban</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">User ID</label>
            <input
              type="text"
              value={newShadowbanUserId}
              onChange={(e) => setNewShadowbanUserId(e.target.value)}
              placeholder="Discord User ID"
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded"
              data-testid="input-shadowban-user-id"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">Reason (optional)</label>
            <input
              type="text"
              value={newShadowbanReason}
              onChange={(e) => setNewShadowbanReason(e.target.value)}
              placeholder="Reason for shadowban"
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded"
              data-testid="input-shadowban-reason"
            />
          </div>
          <button
            onClick={handleAddShadowban}
            disabled={!newShadowbanUserId.trim() || createShadowbanMutation.isPending}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-add-shadowban"
          >
            {createShadowbanMutation.isPending ? 'Adding...' : 'Add Shadowban'}
          </button>
        </div>
      </div>

      {/* List of Current Shadowbans */}
      <div>
        <h3 className="font-medium mb-3 dark:text-white">Current Shadowbans</h3>
        {isLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading shadowbans...</p>
        ) : !shadowbans || shadowbans.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400" data-testid="text-no-shadowbans">No active shadowbans</p>
        ) : (
          <div className="space-y-2">
            {shadowbans.map((shadowban: any) => (
              <div
                key={shadowban.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                data-testid={`shadowban-item-${shadowban.id}`}
              >
                <div className="flex-1">
                  <p className="font-medium dark:text-white">User: {shadowban.username || shadowban.discordId}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Discord ID: {shadowban.discordId}</p>
                  {shadowban.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">Reason: {shadowban.reason}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Added: {new Date(shadowban.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => deleteShadowbanMutation.mutate(shadowban.id)}
                  disabled={deleteShadowbanMutation.isPending}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                  data-testid={`button-remove-shadowban-${shadowban.id}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ModerationPage() {
  const { selectedGuildId } = useGuild();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { setHasUnsavedChanges, setSaveCallback, setOriginalData } = useUnsavedChanges();
  
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/moderation/automod`],
    enabled: !!selectedGuildId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/moderation/automod`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/moderation/automod`] });
      setHasChanges(false);
      setHasUnsavedChanges(false);
    },
  });

  // Register save callback
  useEffect(() => {
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
    setSaveCallback(saveFunction);
  }, [formData, updateSettingsMutation]);

  // Store original data on load
  useEffect(() => {
    if (settings) {
      setOriginalData(settings);
    }
    return () => {
      setHasUnsavedChanges(false);
      setSaveCallback(null);
      setOriginalData(null);
    };
  }, [settings]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setConfirmModalOpen(true);
  };

  const confirmUpdate = () => {
    updateSettingsMutation.mutate(formData);
    setFormData({});
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-10 dark:text-white">Loading...</div>;
  }

  return (
    <div className="dark:text-white">
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-moderation">Moderation & Auto-Mod</h1>
      
      {/* Module Enable/Disable */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold dark:text-white">Module Status</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Enable or disable the entire moderation module</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enabled !== undefined ? formData.enabled : (settings?.enabled || false)}
              onChange={(e) => handleFieldChange("enabled", e.target.checked)}
              className="sr-only peer"
              data-testid="toggle-moderation-enabled"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Basic Features */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Basic Features</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Anti-Spam</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Detect and prevent message spam</p>
            </div>
            <input
              type="checkbox"
              checked={formData.antiSpam !== undefined ? formData.antiSpam : (settings?.antiSpam || false)}
              onChange={(e) => handleFieldChange("antiSpam", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-anti-spam"
            />
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded space-y-2">
            <label className="block text-sm font-medium dark:text-white">Spam Threshold (messages)</label>
            <input
              type="number"
              value={formData.spamThreshold !== undefined ? formData.spamThreshold : (settings?.spamThreshold || 5)}
              onChange={(e) => handleFieldChange("spamThreshold", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded"
              data-testid="input-spam-threshold"
            />
            <label className="block text-sm font-medium dark:text-white mt-2">Spam Time Window (seconds)</label>
            <input
              type="number"
              value={formData.spamTimeWindow !== undefined ? formData.spamTimeWindow : (settings?.spamTimeWindow || 5)}
              onChange={(e) => handleFieldChange("spamTimeWindow", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded"
              data-testid="input-spam-window"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Anti-Invite</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Block Discord invite links</p>
            </div>
            <input
              type="checkbox"
              checked={formData.antiInvite !== undefined ? formData.antiInvite : (settings?.antiInvite || false)}
              onChange={(e) => handleFieldChange("antiInvite", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-anti-invite"
            />
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <label className="block text-sm font-medium mb-2 dark:text-white">Bad Words (comma separated)</label>
            <input
              type="text"
              value={formData.badWords !== undefined ? (Array.isArray(formData.badWords) ? formData.badWords.join(", ") : formData.badWords) : ((settings?.badWords || []).join(", "))}
              onChange={(e) => handleFieldChange("badWords", e.target.value.split(",").map(w => w.trim()))}
              placeholder="word1, word2, word3"
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded"
              data-testid="input-bad-words"
            />
          </div>
        </div>
      </div>

      {/* Advanced Features */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Advanced Features</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Anti-Link</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Block external links in messages</p>
            </div>
            <input
              type="checkbox"
              checked={formData.antiLink !== undefined ? formData.antiLink : (settings?.antiLink || false)}
              onChange={(e) => handleFieldChange("antiLink", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-anti-link"
            />
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded space-y-2">
            <label className="block text-sm font-medium dark:text-white">Auto-Mute Threshold (warnings before mute)</label>
            <input
              type="number"
              value={formData.autoMuteThreshold !== undefined ? formData.autoMuteThreshold : (settings?.autoMuteThreshold || 3)}
              onChange={(e) => handleFieldChange("autoMuteThreshold", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded"
              data-testid="input-automute-threshold"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Mass Mention Protection</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Detect and prevent mention spam</p>
            </div>
            <input
              type="checkbox"
              checked={formData.massMentionProtection !== undefined ? formData.massMentionProtection : (settings?.massMentionProtection || false)}
              onChange={(e) => handleFieldChange("massMentionProtection", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-mass-mention"
            />
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded space-y-2">
            <label className="block text-sm font-medium dark:text-white">Mass Mention Threshold (mentions)</label>
            <input
              type="number"
              value={formData.massMentionThreshold !== undefined ? formData.massMentionThreshold : (settings?.massMentionThreshold || 5)}
              onChange={(e) => handleFieldChange("massMentionThreshold", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded"
              data-testid="input-mention-threshold"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Caps Protection</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Prevent excessive capital letters</p>
            </div>
            <input
              type="checkbox"
              checked={formData.capsProtection !== undefined ? formData.capsProtection : (settings?.capsProtection || false)}
              onChange={(e) => handleFieldChange("capsProtection", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-caps-protection"
            />
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded space-y-2">
            <label className="block text-sm font-medium dark:text-white">Caps Percentage Threshold (%)</label>
            <input
              type="number"
              value={formData.capsPercentage !== undefined ? formData.capsPercentage : (settings?.capsPercentage || 70)}
              onChange={(e) => handleFieldChange("capsPercentage", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded"
              data-testid="input-caps-percentage"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div>
              <p className="font-medium dark:text-white">Duplicate Messages</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Prevent sending the same message repeatedly</p>
            </div>
            <input
              type="checkbox"
              checked={formData.duplicateMessages !== undefined ? formData.duplicateMessages : (settings?.duplicateMessages || false)}
              onChange={(e) => handleFieldChange("duplicateMessages", e.target.checked)}
              className="w-4 h-4"
              data-testid="toggle-duplicate-messages"
            />
          </div>
        </div>
      </div>

      {/* Shadowban Management */}
      <ShadowbanSection selectedGuildId={selectedGuildId} />

      {/* Save/Cancel Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || updateSettingsMutation.isPending}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-save-moderation"
        >
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        {hasChanges && (
          <button
            onClick={() => { setFormData({}); setHasChanges(false); }}
            className="px-6 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
            data-testid="button-cancel-moderation"
          >
            Cancel
          </button>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmUpdate}
        message="Are you sure you want to save these moderation settings?"
      />
    </div>
  );
}

function SecurityPage() {
  const { selectedGuildId } = useGuild();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { setHasUnsavedChanges, setSaveCallback, setOriginalData } = useUnsavedChanges();
  
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/security`],
    enabled: !!selectedGuildId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/security`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/security`] });
      setHasChanges(false);
      setHasUnsavedChanges(false);
    },
  });

  // Register save callback
  useEffect(() => {
    const saveFunction = async () => {
      return new Promise<void>((resolve, reject) => {
        updateMutation.mutate(formData, {
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
    setSaveCallback(saveFunction);
  }, [formData, updateMutation]);

  // Store original data on load
  useEffect(() => {
    if (settings) {
      setOriginalData(settings);
    }
    return () => {
      setHasUnsavedChanges(false);
      setSaveCallback(null);
      setOriginalData(null);
    };
  }, [settings]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setConfirmModalOpen(true);
  };

  const confirmUpdate = () => {
    updateMutation.mutate(formData);
    setFormData({});
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  if (isLoading) return <div className="dark:text-white">Loading...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-security">Security Settings</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">Security Module</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Enable or disable all security features</p>
          </div>
          <input
            type="checkbox"
            checked={formData.enabled !== undefined ? formData.enabled : (settings?.enabled || false)}
            onChange={(e) => handleFieldChange("enabled", e.target.checked)}
            className="w-5 h-5"
            data-testid="toggle-security-enabled"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Security Features</h3>
        
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div>
            <p className="font-medium dark:text-white">Anti-Raid Protection</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Detect and prevent raid attempts</p>
          </div>
          <input
            type="checkbox"
            checked={formData.antiRaid !== undefined ? formData.antiRaid : (settings?.antiRaid || false)}
            onChange={(e) => handleFieldChange("antiRaid", e.target.checked)}
            className="w-4 h-4"
            data-testid="toggle-anti-raid"
          />
        </div>

        {(formData.antiRaid !== undefined ? formData.antiRaid : settings?.antiRaid) && (
          <div className="ml-6 p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <label className="block text-sm font-medium mb-2 dark:text-white">Raid Threshold (joins/min)</label>
            <input
              type="number"
              value={formData.raidThreshold !== undefined ? formData.raidThreshold : (settings?.raidThreshold || 10)}
              onChange={(e) => handleFieldChange("raidThreshold", parseInt(e.target.value))}
              className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded"
              data-testid="input-raid-threshold"
            />
          </div>
        )}

        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div>
            <p className="font-medium dark:text-white">Verification System</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Require new members to verify</p>
          </div>
          <input
            type="checkbox"
            checked={formData.verificationEnabled !== undefined ? formData.verificationEnabled : (settings?.verificationEnabled || false)}
            onChange={(e) => handleFieldChange("verificationEnabled", e.target.checked)}
            className="w-4 h-4"
            data-testid="toggle-verification"
          />
        </div>

        {(formData.verificationEnabled !== undefined ? formData.verificationEnabled : settings?.verificationEnabled) && (
          <div className="ml-6 space-y-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <label className="block text-sm font-medium mb-2 dark:text-white">Verification Role</label>
              <RoleSelector
                value={formData.verificationRole !== undefined ? formData.verificationRole : (settings?.verificationRole || "")}
                onChange={(value) => handleFieldChange("verificationRole", value)}
                guildId={selectedGuildId}
                placeholder="Select verification role..."
                allowNone={true}
                dataTestId="select-verification-role"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Role given to members after verification</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <label className="block text-sm font-medium mb-2 dark:text-white">Verification Channel</label>
              <ChannelSelector
                value={formData.verificationChannel !== undefined ? formData.verificationChannel : (settings?.verificationChannel || "")}
                onChange={(value) => handleFieldChange("verificationChannel", value)}
                guildId={selectedGuildId}
                channelType={0}
                placeholder="Select verification channel..."
                allowNone={true}
                dataTestId="select-verification-channel"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Channel where members verify themselves</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-save-security"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          {hasChanges && (
            <button
              onClick={() => { setFormData({}); setHasChanges(false); }}
              className="px-6 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              data-testid="button-cancel-security"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmUpdate}
        message="Are you sure you want to save these security settings?"
      />
    </div>
  );
}

function LoggingPage() {
  const { selectedGuildId } = useGuild();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { setHasUnsavedChanges, setSaveCallback, setOriginalData } = useUnsavedChanges();
  
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/logging`],
    enabled: !!selectedGuildId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/logging`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/logging`] });
      setHasChanges(false);
      setHasUnsavedChanges(false);
    },
  });

  // Register save callback
  useEffect(() => {
    const saveFunction = async () => {
      return new Promise<void>((resolve, reject) => {
        updateMutation.mutate(formData, {
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
    setSaveCallback(saveFunction);
  }, [formData, updateMutation]);

  // Store original data on load
  useEffect(() => {
    if (settings) {
      setOriginalData(settings);
    }
    return () => {
      setHasUnsavedChanges(false);
      setSaveCallback(null);
      setOriginalData(null);
    };
  }, [settings]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setConfirmModalOpen(true);
  };

  const confirmUpdate = () => {
    updateMutation.mutate(formData);
    setFormData({});
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  if (isLoading) return <div className="dark:text-white">Loading...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-logging">Logging Configuration</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">Logging Module</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Enable or disable event logging</p>
          </div>
          <input
            type="checkbox"
            checked={formData.enabled !== undefined ? formData.enabled : (settings?.enabled || false)}
            onChange={(e) => handleFieldChange("enabled", e.target.checked)}
            className="w-5 h-5"
            data-testid="toggle-logging-enabled"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Log Channel</h3>
        <ChannelSelector
          value={formData.logChannel !== undefined ? formData.logChannel : (settings?.logChannel || "")}
          onChange={(value) => handleFieldChange("logChannel", value)}
          guildId={selectedGuildId}
          channelType={0}
          placeholder="Select log channel..."
          allowNone={true}
          dataTestId="select-log-channel"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">All logged events will be sent to this channel</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Events to Log</h3>
        
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div>
            <p className="font-medium dark:text-white">Member Joins</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Log when members join the server</p>
          </div>
          <input
            type="checkbox"
            checked={formData.logJoins !== undefined ? formData.logJoins : (settings?.logJoins || false)}
            onChange={(e) => handleFieldChange("logJoins", e.target.checked)}
            className="w-4 h-4"
            data-testid="toggle-log-joins"
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div>
            <p className="font-medium dark:text-white">Member Leaves</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Log when members leave the server</p>
          </div>
          <input
            type="checkbox"
            checked={formData.logLeaves !== undefined ? formData.logLeaves : (settings?.logLeaves || false)}
            onChange={(e) => handleFieldChange("logLeaves", e.target.checked)}
            className="w-4 h-4"
            data-testid="toggle-log-leaves"
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div>
            <p className="font-medium dark:text-white">Deleted Messages</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Log deleted and edited messages</p>
          </div>
          <input
            type="checkbox"
            checked={formData.logMessages !== undefined ? formData.logMessages : (settings?.logMessages || false)}
            onChange={(e) => handleFieldChange("logMessages", e.target.checked)}
            className="w-4 h-4"
            data-testid="toggle-log-messages"
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div>
            <p className="font-medium dark:text-white">Moderation Actions</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Log warnings, mutes, kicks, and bans</p>
          </div>
          <input
            type="checkbox"
            checked={formData.logModeration !== undefined ? formData.logModeration : (settings?.logModeration !== false)}
            onChange={(e) => handleFieldChange("logModeration", e.target.checked)}
            className="w-4 h-4"
            data-testid="toggle-log-moderation"
          />
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div>
            <p className="font-medium dark:text-white">Command Usage</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Log all bot command executions</p>
          </div>
          <input
            type="checkbox"
            checked={formData.logCommands !== undefined ? formData.logCommands : (settings?.logCommands || false)}
            onChange={(e) => handleFieldChange("logCommands", e.target.checked)}
            className="w-4 h-4"
            data-testid="toggle-log-commands"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-save-logging"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          {hasChanges && (
            <button
              onClick={() => { setFormData({}); setHasChanges(false); }}
              className="px-6 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              data-testid="button-cancel-logging"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmUpdate}
        message="Are you sure you want to save these logging settings?"
      />
    </div>
  );
}

function UserTrackingPage() {
  const { selectedGuildId } = useGuild();

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-tracking">User Activity Tracking</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold dark:text-white">Activity Monitoring</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Track when users were last active in your server</p>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          The bot automatically tracks user activity. Use the <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/seen @user</code> command to check when a user was last active.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Features</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
              <p className="font-medium dark:text-white">Automatic Tracking</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">User activity is automatically recorded when they send messages</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
              <p className="font-medium dark:text-white">Last Seen Command</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Check when any user was last active with <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">/seen</code></p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
              <p className="font-medium dark:text-white">Privacy Focused</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Only stores last activity timestamp, no message content</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomePage() {
  const { selectedGuildId } = useGuild();
  const [formData, setFormData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { setHasUnsavedChanges, setSaveCallback, setOriginalData } = useUnsavedChanges();

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/welcome`],
    enabled: !!selectedGuildId
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/guilds/${selectedGuildId}/welcome`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/welcome`] });
      setHasChanges(false);
      setHasUnsavedChanges(false);
    }
  });

  // Register save callback
  useEffect(() => {
    const saveFunction = async () => {
      return new Promise<void>((resolve, reject) => {
        updateMutation.mutate(formData, {
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
    setSaveCallback(saveFunction);
  }, [formData, updateMutation]);

  // Store original data on load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setOriginalData(settings);
    }
    return () => {
      setHasUnsavedChanges(false);
      setSaveCallback(null);
      setOriginalData(null);
    };
  }, [settings]);

  if (!selectedGuildId) {
    return <div className="text-center py-10 dark:text-white"><p className="text-xl mb-4">Please select a server from the dropdown above</p></div>;
  }

  if (isLoading) {
    return <div className="text-center py-10 dark:text-white">Loading...</div>;
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setConfirmModalOpen(true);
  };

  const confirmUpdate = () => {
    updateMutation.mutate(formData);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-welcome">Welcome & Leave System</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Welcome Messages</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled || false}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="w-4 h-4"
              data-testid="checkbox-welcome-enabled"
            />
            <label htmlFor="enabled" className="dark:text-white">Enable Welcome Messages</label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-white">Welcome Channel</label>
            <ChannelSelector
              value={formData.welcomeChannelId || ''}
              onChange={(value) => handleChange('welcomeChannelId', value)}
              guildId={selectedGuildId}
              channelType={0}
              placeholder="Select welcome channel..."
              allowNone={true}
              dataTestId="select-welcome-channel"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Channel where welcome messages will be sent</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-white">Welcome Message</label>
            <textarea
              value={formData.welcomeMessage || ''}
              onChange={(e) => handleChange('welcomeMessage', e.target.value)}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Welcome {user} to {server}!"
              data-testid="input-welcome-message"
            />
            <p className="text-sm text-gray-500 mt-1">Variables: {'{user}'}, {'{user.tag}'}, {'{server}'}, {'{server.members}'}</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="embedEnabled"
              checked={formData.welcomeEmbedEnabled || false}
              onChange={(e) => handleChange('welcomeEmbedEnabled', e.target.checked)}
              className="w-4 h-4"
              data-testid="checkbox-embed-enabled"
            />
            <label htmlFor="embedEnabled" className="dark:text-white">Use Embed for Welcome</label>
          </div>

          {formData.welcomeEmbedEnabled && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Embed Color</label>
                <input
                  type="text"
                  value={formData.welcomeEmbedColor || '#5865F2'}
                  onChange={(e) => handleChange('welcomeEmbedColor', e.target.value)}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
                  placeholder="#5865F2"
                  data-testid="input-embed-color"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Embed Title</label>
                <input
                  type="text"
                  value={formData.welcomeEmbedTitle || ''}
                  onChange={(e) => handleChange('welcomeEmbedTitle', e.target.value)}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
                  placeholder="Welcome!"
                  data-testid="input-embed-title"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Leave Messages</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="leaveEnabled"
              checked={formData.leaveEnabled || false}
              onChange={(e) => handleChange('leaveEnabled', e.target.checked)}
              className="w-4 h-4"
              data-testid="checkbox-leave-enabled"
            />
            <label htmlFor="leaveEnabled" className="dark:text-white">Enable Leave Messages</label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-white">Leave Channel</label>
            <ChannelSelector
              value={formData.leaveChannelId || ''}
              onChange={(value) => handleChange('leaveChannelId', value)}
              guildId={selectedGuildId}
              channelType={0}
              placeholder="Select leave channel..."
              allowNone={true}
              dataTestId="select-leave-channel"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Channel where leave messages will be sent</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-white">Leave Message</label>
            <textarea
              value={formData.leaveMessage || ''}
              onChange={(e) => handleChange('leaveMessage', e.target.value)}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white"
              rows={2}
              placeholder="{user} has left {server}."
              data-testid="input-leave-message"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Auto-Roles</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoRoleEnabled"
              checked={formData.autoRoleEnabled || false}
              onChange={(e) => handleChange('autoRoleEnabled', e.target.checked)}
              className="w-4 h-4"
              data-testid="checkbox-autorole-enabled"
            />
            <label htmlFor="autoRoleEnabled" className="dark:text-white">Auto-Assign Roles on Join</label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-white">Auto-Assign Roles</label>
            <MultiRoleSelector
              value={formData.autoRoleIds || []}
              onChange={(value) => handleChange('autoRoleIds', value)}
              guildId={selectedGuildId}
              placeholder="Select roles to auto-assign..."
              dataTestId="select-autorole-ids"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">These roles will be automatically given to new members</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          data-testid="button-save-welcome"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        {hasChanges && (
          <button
            onClick={() => { setFormData(settings); setHasChanges(false); }}
            className="px-6 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded"
            data-testid="button-cancel-welcome"
          >
            Cancel
          </button>
        )}
      </div>

      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmUpdate}
        message="Save welcome/leave settings?"
      />
    </div>
  );
}

function ReactionRolesPage() {
  const { selectedGuildId } = useGuild();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  const { data: roles, isLoading } = useQuery<any[]>({
    queryKey: [`/api/guilds/${selectedGuildId}/reaction-roles`],
    enabled: !!selectedGuildId
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/guilds/${selectedGuildId}/reaction-roles`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/reaction-roles`] });
      setModalOpen(false);
      setEditingRole(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/guilds/${selectedGuildId}/reaction-roles/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/reaction-roles`] });
    }
  });

  if (!selectedGuildId) {
    return <div className="text-center py-10 dark:text-white"><p className="text-xl mb-4">Please select a server</p></div>;
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      channelId: formData.get('channelId'),
      messageId: formData.get('messageId'),
      emoji: formData.get('emoji'),
      roleId: formData.get('roleId'),
      description: formData.get('description')
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-white" data-testid="heading-reactions">Reaction Roles</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          data-testid="button-add-reaction"
        >
          + Add Reaction Role
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 dark:text-white">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {roles && roles.length > 0 ? (
            roles.map((role: any) => (
              <div key={role.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium dark:text-white">Emoji: {role.emoji} → Role: {role.roleId}</p>
                    <p className="text-sm text-gray-500 mt-1">Message: {role.messageId}</p>
                    {role.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{role.description}</p>}
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(role.id)}
                    className="text-red-500 hover:text-red-700"
                    data-testid={`button-delete-reaction-${role.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg">
              <p className="dark:text-white">No reaction roles configured yet</p>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full m-4">
            <h3 className="text-xl font-bold mb-4 dark:text-white">Add Reaction Role</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Channel ID</label>
                <input name="channelId" required className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" data-testid="input-channel-id" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Message ID</label>
                <input name="messageId" required className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" data-testid="input-message-id" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Emoji</label>
                <input name="emoji" required className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" placeholder="👍 or emoji ID" data-testid="input-emoji" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Role ID</label>
                <input name="roleId" required className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" data-testid="input-role-id" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Description (optional)</label>
                <input name="description" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" data-testid="input-description" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" data-testid="button-submit-reaction">
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EmbedsPage() {
  const { selectedGuildId } = useGuild();
  const [modalOpen, setModalOpen] = useState(false);
  const [previewEmbed, setPreviewEmbed] = useState<any>(null);

  const { data: templates, isLoading } = useQuery<any[]>({
    queryKey: [`/api/guilds/${selectedGuildId}/embeds`],
    enabled: !!selectedGuildId
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/guilds/${selectedGuildId}/embeds`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/embeds`] });
      setModalOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/guilds/${selectedGuildId}/embeds/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/embeds`] });
    }
  });

  if (!selectedGuildId) {
    return <div className="text-center py-10 dark:text-white"><p className="text-xl mb-4">Please select a server</p></div>;
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const embedData = {
      title: formData.get('title'),
      description: formData.get('description'),
      color: parseInt((formData.get('color') as string).replace('#', ''), 16),
      footer: formData.get('footer') ? { text: formData.get('footer') } : undefined
    };
    
    createMutation.mutate({
      name: formData.get('name'),
      description: formData.get('templateDesc'),
      embedData
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-white" data-testid="heading-embeds">Embed Builder</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          data-testid="button-add-embed"
        >
          + Create Embed
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 dark:text-white">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {templates && templates.length > 0 ? (
            templates.map((template: any) => (
              <div key={template.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold dark:text-white">{template.name}</h3>
                    <p className="text-sm text-gray-500">{template.description}</p>
                    <div className="mt-2 p-3 border-l-4 rounded" style={{ borderColor: `#${template.embedData.color?.toString(16).padStart(6, '0')}` }}>
                      <p className="font-medium dark:text-white">{template.embedData.title}</p>
                      <p className="text-sm dark:text-gray-400">{template.embedData.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(template.id)}
                    className="text-red-500 hover:text-red-700"
                    data-testid={`button-delete-embed-${template.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg">
              <p className="dark:text-white">No embeds created yet</p>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 dark:text-white">Create Embed</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Template Name</label>
                <input name="name" required className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" data-testid="input-embed-name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Template Description</label>
                <input name="templateDesc" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" data-testid="input-embed-desc" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Embed Title</label>
                <input name="title" required className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" data-testid="input-embed-title-field" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Embed Description</label>
                <textarea name="description" required className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" rows={4} data-testid="input-embed-description-field" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Color</label>
                <input name="color" type="color" defaultValue="#5865F2" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white h-12" data-testid="input-embed-color-field" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-white">Footer (optional)</label>
                <input name="footer" className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:text-white" data-testid="input-embed-footer" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" data-testid="button-submit-embed">
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatisticsPage() {
  const { selectedGuildId } = useGuild();

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/stats`],
    enabled: !!selectedGuildId
  });

  if (!selectedGuildId) {
    return <div className="text-center py-10 dark:text-white"><p className="text-xl mb-4">Please select a server</p></div>;
  }

  if (isLoading) {
    return <div className="text-center py-10 dark:text-white">Loading statistics...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-stats">Server Statistics</h1>
      
      {stats && (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Members</div>
              <div className="text-3xl font-bold dark:text-white" data-testid="stat-total-members">{stats.totalMembers}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">Human Members</div>
              <div className="text-3xl font-bold dark:text-white" data-testid="stat-human-members">{stats.humanMembers}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">Bot Members</div>
              <div className="text-3xl font-bold dark:text-white" data-testid="stat-bot-members">{stats.botMembers}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 dark:text-white">Channels</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="dark:text-gray-400">Text Channels</span>
                  <span className="font-medium dark:text-white" data-testid="stat-text-channels">{stats.textChannels}</span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-gray-400">Voice Channels</span>
                  <span className="font-medium dark:text-white" data-testid="stat-voice-channels">{stats.voiceChannels}</span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-gray-400">Categories</span>
                  <span className="font-medium dark:text-white" data-testid="stat-categories">{stats.categories}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 dark:text-white">Server Info</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="dark:text-gray-400">Roles</span>
                  <span className="font-medium dark:text-white" data-testid="stat-roles">{stats.roles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-gray-400">Emojis</span>
                  <span className="font-medium dark:text-white" data-testid="stat-emojis">{stats.emojis}</span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-gray-400">Boost Level</span>
                  <span className="font-medium dark:text-white" data-testid="stat-boost-level">{stats.boostLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="dark:text-gray-400">Boosts</span>
                  <span className="font-medium dark:text-white" data-testid="stat-boost-count">{stats.boostCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Server Details</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Server Name</p>
                <p className="font-medium dark:text-white" data-testid="stat-server-name">{stats.guildName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Server ID</p>
                <p className="font-medium font-mono text-sm dark:text-white" data-testid="stat-server-id">{stats.guildId}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                <p className="font-medium dark:text-white" data-testid="stat-created-at">{new Date(stats.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Online Members</p>
                <p className="font-medium dark:text-white" data-testid="stat-online-members">{stats.onlineMembers}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CommandsPage() {
  const { selectedGuildId } = useGuild();
  const [commandModalOpen, setCommandModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<any>(null);
  const [isSlashCommand, setIsSlashCommand] = useState(false);

  const { data: commands, isLoading: commandsLoading } = useQuery<any[]>({
    queryKey: ['/api/guilds', selectedGuildId, 'commands'],
    enabled: !!selectedGuildId
  });

  const { data: guildSettings } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/settings`],
    enabled: !!selectedGuildId
  });

  const createCommandMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/guilds/${selectedGuildId}/commands`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guilds', selectedGuildId, 'commands'] });
      setCommandModalOpen(false);
      setEditingCommand(null);
    }
  });

  const updateCommandMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return await apiRequest(`/api/guilds/${selectedGuildId}/commands/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guilds', selectedGuildId, 'commands'] });
      setCommandModalOpen(false);
      setEditingCommand(null);
    }
  });

  const deleteCommandMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/guilds/${selectedGuildId}/commands/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guilds', selectedGuildId, 'commands'] });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      trigger: formData.get('trigger') as string,
      response: formData.get('response') as string,
      description: formData.get('description') as string,
      isSlashCommand,
      embedEnabled: formData.get('embedEnabled') === 'on',
      embedColor: formData.get('embedColor') as string,
      embedTitle: formData.get('embedTitle') as string,
    };

    if (editingCommand) {
      updateCommandMutation.mutate({ id: editingCommand.id, ...data });
    } else {
      createCommandMutation.mutate(data);
    }
  };

  if (!selectedGuildId) {
    return <div className="text-center py-12 dark:text-white">Please select a server from the dropdown above.</div>;
  }

  if (commandsLoading) {
    return <div className="text-center py-12 dark:text-white">Loading...</div>;
  }

  const hasPrefix = guildSettings?.prefix;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-commands">Custom Commands</h1>
      
      {!hasPrefix && (
        <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded">
          <p className="text-yellow-800 dark:text-yellow-200">⚠️ No prefix set! Configure a prefix in Settings to use prefix commands.</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <button
          onClick={() => {
            setEditingCommand(null);
            setIsSlashCommand(false);
            setCommandModalOpen(true);
          }}
          className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          data-testid="button-create-command"
        >
          Create Custom Command
        </button>

        {commands && commands.length > 0 ? (
          <table className="w-full mt-4">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left p-2 dark:text-white">Trigger</th>
                <th className="text-left p-2 dark:text-white">Type</th>
                <th className="text-left p-2 dark:text-white">Description</th>
                <th className="text-left p-2 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commands.map((cmd) => (
                <tr key={cmd.id} className="border-b dark:border-gray-700" data-testid={`row-command-${cmd.id}`}>
                  <td className="p-2 dark:text-white">{cmd.isSlashCommand ? `/${cmd.trigger}` : `${guildSettings?.prefix || '!'}${cmd.trigger}`}</td>
                  <td className="p-2 dark:text-white">
                    <span className={`px-2 py-1 rounded text-xs ${cmd.isSlashCommand ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                      {cmd.isSlashCommand ? 'Slash' : 'Prefix'}
                    </span>
                  </td>
                  <td className="p-2 dark:text-white text-sm">{cmd.description || '-'}</td>
                  <td className="p-2 space-x-2">
                    <button
                      onClick={() => {
                        setEditingCommand(cmd);
                        setIsSlashCommand(cmd.isSlashCommand);
                        setCommandModalOpen(true);
                      }}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      data-testid={`button-edit-command-${cmd.id}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCommandMutation.mutate(cmd.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      data-testid={`button-delete-command-${cmd.id}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-600 dark:text-gray-400 mt-4">No custom commands yet. Create one to get started!</p>
        )}
      </div>

      {commandModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 dark:text-white">{editingCommand ? 'Edit' : 'Create'} Custom Command</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={isSlashCommand}
                    onChange={(e) => setIsSlashCommand(e.target.checked)}
                    className="w-4 h-4"
                    data-testid="checkbox-slash-command"
                  />
                  <span className="text-sm font-medium dark:text-white">Use Slash Command (/) instead of Prefix ({guildSettings?.prefix || '!'})</span>
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Command Trigger</label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">{isSlashCommand ? '/' : guildSettings?.prefix || '!'}</span>
                  <input
                    type="text"
                    name="trigger"
                    defaultValue={editingCommand?.trigger || ""}
                    required
                    placeholder="ping"
                    pattern={isSlashCommand ? "[a-z0-9_-]{1,32}" : ".*"}
                    title={isSlashCommand ? "Slash commands must be lowercase, 1-32 characters, and can only contain letters, numbers, hyphens, and underscores" : ""}
                    data-testid="input-command-trigger"
                    className="flex-1 px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
                {isSlashCommand && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Must be lowercase, 1-32 characters (letters, numbers, hyphens, underscores only)
                  </p>
                )}
              </div>

              {isSlashCommand && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1 dark:text-white">Description (required for slash commands)</label>
                  <input
                    type="text"
                    name="description"
                    defaultValue={editingCommand?.description || ""}
                    required={isSlashCommand}
                    placeholder="Ping the bot"
                    data-testid="input-command-description"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 dark:text-white">Response (Template Code)</label>
                <textarea
                  name="response"
                  defaultValue={editingCommand?.response || ""}
                  required
                  rows={10}
                  placeholder="Pong! Latency: {ping}ms"
                  data-testid="input-command-response"
                  className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded font-mono text-sm"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Template variables: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{"{user}"}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{"{user.id}"}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{"{user.username}"}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{"{server}"}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{"{channel}"}</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{"{ping}"}</code>
                </p>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="embedEnabled"
                    defaultChecked={editingCommand?.embedEnabled || false}
                    className="w-4 h-4"
                    data-testid="checkbox-embed-enabled"
                  />
                  <span className="text-sm font-medium dark:text-white">Send as Embed</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Embed Title (optional)</label>
                  <input
                    type="text"
                    name="embedTitle"
                    defaultValue={editingCommand?.embedTitle || ""}
                    data-testid="input-embed-title"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Embed Color (hex)</label>
                  <input
                    type="text"
                    name="embedColor"
                    defaultValue={editingCommand?.embedColor || "#5865F2"}
                    placeholder="#5865F2"
                    data-testid="input-embed-color"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCommandModalOpen(false);
                    setEditingCommand(null);
                  }}
                  data-testid="button-cancel-command"
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="button-submit-command"
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  {editingCommand ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GiveawayPage() {
  const { selectedGuildId } = useGuild();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const { setHasUnsavedChanges, setSaveCallback, setOriginalData } = useUnsavedChanges();
  
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [modifierModalOpen, setModifierModalOpen] = useState(false);
  const [editingModifier, setEditingModifier] = useState<any>(null);

  // Fetch giveaway settings
  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/giveaway-settings`],
    enabled: !!selectedGuildId,
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/giveaway-templates`],
    enabled: !!selectedGuildId,
  });

  // Fetch role modifiers
  const { data: roleModifiers = [], isLoading: modifiersLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/giveaway-role-modifiers`],
    enabled: !!selectedGuildId,
  });

  // Fetch active giveaways
  const { data: giveaways = [], isLoading: giveawaysLoading } = useQuery<any>({
    queryKey: [`/api/guilds/${selectedGuildId}/giveaways`],
    enabled: !!selectedGuildId,
  });

  // Settings mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/giveaway-settings`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/giveaway-settings`] });
      setHasChanges(false);
      setHasUnsavedChanges(false);
    },
  });

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/giveaway-templates`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/giveaway-templates`] });
      setTemplateModalOpen(false);
      setEditingTemplate(null);
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest(`/api/guilds/${selectedGuildId}/giveaway-templates/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/giveaway-templates`] });
      setTemplateModalOpen(false);
      setEditingTemplate(null);
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/guilds/${selectedGuildId}/giveaway-templates/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/giveaway-templates`] });
    },
  });

  // Role modifier mutations
  const createModifierMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/guilds/${selectedGuildId}/giveaway-role-modifiers`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/giveaway-role-modifiers`] });
      setModifierModalOpen(false);
      setEditingModifier(null);
    },
  });

  const updateModifierMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest(`/api/guilds/${selectedGuildId}/giveaway-role-modifiers/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/giveaway-role-modifiers`] });
      setModifierModalOpen(false);
      setEditingModifier(null);
    },
  });

  const deleteModifierMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/guilds/${selectedGuildId}/giveaway-role-modifiers/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/guilds/${selectedGuildId}/giveaway-role-modifiers`] });
    },
  });

  // Register save callback
  useEffect(() => {
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
    setSaveCallback(saveFunction);
  }, [formData, updateSettingsMutation]);

  // Store original data on load
  useEffect(() => {
    if (settings) {
      setOriginalData(settings);
    }
  }, [settings]);

  // Sync hasChanges with global state
  useEffect(() => {
    setHasUnsavedChanges(hasChanges);
  }, [hasChanges]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setConfirmModalOpen(true);
  };

  const confirmUpdate = () => {
    updateSettingsMutation.mutate(formData);
    setFormData({});
  };

  const handleTemplateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name"),
      prize: form.get("prize"),
      duration: parseInt(form.get("duration") as string),
      winnerCount: parseInt(form.get("winnerCount") as string),
      description: form.get("description") || undefined,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleModifierSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      roleId: form.get("roleId"),
      roleName: form.get("roleName"),
      multiplier: parseFloat(form.get("multiplier") as string),
    };

    if (editingModifier) {
      updateModifierMutation.mutate({ id: editingModifier.id, data });
    } else {
      createModifierMutation.mutate(data);
    }
  };

  if (!selectedGuildId) {
    return (
      <div className="text-center py-10 dark:text-white">
        <p className="text-xl mb-4">Please select a server from the dropdown above</p>
      </div>
    );
  }

  if (settingsLoading) return <div className="dark:text-white">Loading...</div>;

  const activeGiveaways = giveaways.filter((g: any) => !g.ended);
  const endedGiveaways = giveaways.filter((g: any) => g.ended);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-giveaways">Giveaway Settings</h1>
      
      {/* Module Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">Giveaway Module</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Enable or disable giveaway features</p>
          </div>
          <input
            type="checkbox"
            checked={formData.enabled !== undefined ? formData.enabled : (settings?.enabled || false)}
            onChange={(e) => handleFieldChange("enabled", e.target.checked)}
            className="w-5 h-5"
            data-testid="toggle-giveaway-enabled"
          />
        </div>
        
        {hasChanges && (
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-save-giveaway-settings"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => { setFormData({}); setHasChanges(false); }}
              className="px-6 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              data-testid="button-cancel-giveaway-settings"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Giveaway Templates Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">Giveaway Templates</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Create reusable giveaway templates</p>
          </div>
          <button
            onClick={() => {
              setEditingTemplate(null);
              setTemplateModalOpen(true);
            }}
            data-testid="button-create-template"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add Template
          </button>
        </div>

        {templatesLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading templates...</p>
        ) : templates.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No templates created yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template: any) => (
              <div key={template.id} className="border dark:border-gray-700 rounded-lg p-4" data-testid={`card-template-${template.id}`}>
                <h3 className="font-semibold text-lg dark:text-white mb-2">{template.name}</h3>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <p><strong>Prize:</strong> {template.prize}</p>
                  <p><strong>Duration:</strong> {template.duration} minutes</p>
                  <p><strong>Winners:</strong> {template.winnerCount}</p>
                  {template.description && <p><strong>Description:</strong> {template.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingTemplate(template);
                      setTemplateModalOpen(true);
                    }}
                    data-testid={`button-edit-template-${template.id}`}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => confirm("Delete this template?") && deleteTemplateMutation.mutate(template.id)}
                    data-testid={`button-delete-template-${template.id}`}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role Modifiers Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">Role Modifiers</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Modify giveaway entry chances based on roles. Multiplier of 1.0 = normal chance, 0.5 = half entries, 2.0 = double entries
            </p>
          </div>
          <button
            onClick={() => {
              setEditingModifier(null);
              setModifierModalOpen(true);
            }}
            data-testid="button-create-modifier"
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add Modifier
          </button>
        </div>

        {modifiersLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading modifiers...</p>
        ) : roleModifiers.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No role modifiers created yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roleModifiers.map((modifier: any) => (
              <div key={modifier.id} className="border dark:border-gray-700 rounded-lg p-4" data-testid={`card-modifier-${modifier.id}`}>
                <h3 className="font-semibold text-lg dark:text-white mb-2">{modifier.roleName}</h3>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <p><strong>Role ID:</strong> {modifier.roleId}</p>
                  <p><strong>Multiplier:</strong> {modifier.multiplier}x</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingModifier(modifier);
                      setModifierModalOpen(true);
                    }}
                    data-testid={`button-edit-modifier-${modifier.id}`}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => confirm("Delete this modifier?") && deleteModifierMutation.mutate(modifier.id)}
                    data-testid={`button-delete-modifier-${modifier.id}`}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Giveaways Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold dark:text-white mb-4">Active Giveaways</h2>
        {giveawaysLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading giveaways...</p>
        ) : activeGiveaways.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No active giveaways.</p>
        ) : (
          <div className="space-y-3 mb-6">
            {activeGiveaways.map((giveaway: any) => (
              <div key={giveaway.id} className="border dark:border-gray-700 rounded-lg p-4" data-testid={`card-active-giveaway-${giveaway.id}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold dark:text-white">{giveaway.prize}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Ends: {new Date(giveaway.endTime).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Winners: {giveaway.winnerCount}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-sm">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="text-lg font-semibold dark:text-white mb-3">Ended Giveaways</h3>
        {endedGiveaways.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No ended giveaways.</p>
        ) : (
          <div className="space-y-3">
            {endedGiveaways.map((giveaway: any) => (
              <div key={giveaway.id} className="border dark:border-gray-700 rounded-lg p-4" data-testid={`card-ended-giveaway-${giveaway.id}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold dark:text-white">{giveaway.prize}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Ended: {new Date(giveaway.endTime).toLocaleString()}
                    </p>
                    {giveaway.winners && giveaway.winners.length > 0 && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Winners: {giveaway.winners.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm">
                    Ended
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Modal */}
      {templateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setTemplateModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()} data-testid="modal-template">
            <h3 className="text-xl font-bold mb-4 dark:text-white">
              {editingTemplate ? "Edit Template" : "Create Template"}
            </h3>
            <form onSubmit={handleTemplateSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingTemplate?.name || ""}
                    required
                    data-testid="input-template-name"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Prize</label>
                  <input
                    type="text"
                    name="prize"
                    defaultValue={editingTemplate?.prize || ""}
                    required
                    data-testid="input-template-prize"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Duration (minutes)</label>
                  <input
                    type="number"
                    name="duration"
                    defaultValue={editingTemplate?.duration || 60}
                    required
                    min="1"
                    data-testid="input-template-duration"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Winner Count</label>
                  <input
                    type="number"
                    name="winnerCount"
                    defaultValue={editingTemplate?.winnerCount || 1}
                    required
                    min="1"
                    data-testid="input-template-winner-count"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Description (optional)</label>
                  <textarea
                    name="description"
                    defaultValue={editingTemplate?.description || ""}
                    rows={3}
                    data-testid="input-template-description"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setTemplateModalOpen(false);
                    setEditingTemplate(null);
                  }}
                  data-testid="button-cancel-template"
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="button-submit-template"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {editingTemplate ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modifier Modal */}
      {modifierModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setModifierModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()} data-testid="modal-modifier">
            <h3 className="text-xl font-bold mb-4 dark:text-white">
              {editingModifier ? "Edit Role Modifier" : "Create Role Modifier"}
            </h3>
            <form onSubmit={handleModifierSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Role ID</label>
                  <input
                    type="text"
                    name="roleId"
                    defaultValue={editingModifier?.roleId || ""}
                    required
                    data-testid="input-modifier-role-id"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Role Name</label>
                  <input
                    type="text"
                    name="roleName"
                    defaultValue={editingModifier?.roleName || ""}
                    required
                    data-testid="input-modifier-role-name"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-white">Multiplier</label>
                  <input
                    type="number"
                    name="multiplier"
                    defaultValue={editingModifier?.multiplier || 1.0}
                    required
                    step="0.1"
                    min="0.1"
                    data-testid="input-modifier-multiplier"
                    className="w-full px-3 py-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    1.0 = normal chance, 0.5 = half entries, 2.0 = double entries
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setModifierModalOpen(false);
                    setEditingModifier(null);
                  }}
                  data-testid="button-cancel-modifier"
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="button-submit-modifier"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {editingModifier ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={confirmUpdate}
        message="Are you sure you want to save these giveaway settings?"
      />
    </div>
  );
}

function SettingsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 dark:text-white" data-testid="heading-settings">Exo Settings</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-gray-600 dark:text-gray-300">Configure Exo prefix, status, and general settings.</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Command Prefix</label>
            <input type="text" data-testid="input-prefix" className="w-full px-3 py-2 border rounded" placeholder="!" />
          </div>
          <button data-testid="button-save-settings" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
