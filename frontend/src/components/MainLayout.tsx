import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FloatingActionButton } from './FloatingActionButton';
import { useKeyboardShortcuts, getCommonShortcuts } from '../hooks/useKeyboardShortcuts';
import { useTheme } from '../contexts/ThemeContext';

interface MainLayoutProps {
  children: React.ReactNode;
  onNewTask?: () => void;
  showFAB?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  onNewTask,
  showFAB = true 
}) => {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Focus search input
  const focusSearch = () => {
    const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  };

  // Define keyboard shortcuts
  const shortcuts = getCommonShortcuts({
    onNewTask: onNewTask,
    onSearch: focusSearch,
    onToggleTheme: toggleTheme,
    onNavigateDashboard: () => navigate('/dashboard'),
    onNavigateProjects: () => navigate('/projects'),
    onNavigateCalendar: () => navigate('/calendar'),
    onNavigateAnalytics: () => navigate('/analytics'),
  });

  // Add help shortcut
  const allShortcuts = [
    ...shortcuts,
    {
      key: '?',
      shift: true,
      callback: () => setShowShortcutsHelp(!showShortcutsHelp),
      description: 'Show shortcuts',
    },
  ];

  useKeyboardShortcuts(allShortcuts);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar />

      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="ml-64 mt-16 p-6">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Floating Action Button */}
      {showFAB && onNewTask && (
        <FloatingActionButton onClick={onNewTask} label="New Task (Ctrl+N)" />
      )}

      {/* Keyboard Shortcuts Help */}
      {showShortcutsHelp && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShowShortcutsHelp(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                ⌨️ Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {allShortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {shortcut.description}
                  </span>
                  <kbd className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 font-mono text-sm">
                    {shortcut.ctrl && 'Ctrl+'}
                    {shortcut.shift && 'Shift+'}
                    {shortcut.alt && 'Alt+'}
                    {shortcut.key === '?' ? '?' : shortcut.key.toUpperCase()}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Press <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Shift+?</kbd> to toggle this help
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
