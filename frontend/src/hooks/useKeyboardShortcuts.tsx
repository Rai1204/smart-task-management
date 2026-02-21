import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  callback: () => void;
  description: string;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchingShortcut = shortcuts.find((shortcut) => {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Common keyboard shortcuts for the app
export const getCommonShortcuts = (handlers: {
  onNewTask?: () => void;
  onSearch?: () => void;
  onToggleTheme?: () => void;
  onNavigateDashboard?: () => void;
  onNavigateProjects?: () => void;
  onNavigateCalendar?: () => void;
  onNavigateAnalytics?: () => void;
}): KeyboardShortcut[] => [
  {
    key: 'n',
    ctrl: true,
    callback: handlers.onNewTask || (() => {}),
    description: 'Create new task',
  },
  {
    key: 'k',
    ctrl: true,
    callback: handlers.onSearch || (() => {}),
    description: 'Focus search',
  },
  {
    key: 'd',
    ctrl: true,
    shift: true,
    callback: handlers.onToggleTheme || (() => {}),
    description: 'Toggle dark mode',
  },
  {
    key: '1',
    ctrl: true,
    callback: handlers.onNavigateDashboard || (() => {}),
    description: 'Go to Dashboard',
  },
  {
    key: '2',
    ctrl: true,
    callback: handlers.onNavigateProjects || (() => {}),
    description: 'Go to Projects',
  },
  {
    key: '3',
    ctrl: true,
    callback: handlers.onNavigateCalendar || (() => {}),
    description: 'Go to Calendar',
  },
  {
    key: '4',
    ctrl: true,
    callback: handlers.onNavigateAnalytics || (() => {}),
    description: 'Go to Analytics',
  },
];

// Component to display keyboard shortcuts help
export const KeyboardShortcutsHelp: React.FC<{ shortcuts: KeyboardShortcut[] }> = ({ shortcuts }) => {
  return (
    <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 max-w-sm z-50">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
        ⌨️ Keyboard Shortcuts
      </h3>
      <div className="space-y-2">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">{shortcut.description}</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 font-mono">
              {shortcut.ctrl && 'Ctrl+'}
              {shortcut.shift && 'Shift+'}
              {shortcut.alt && 'Alt+'}
              {shortcut.key.toUpperCase()}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
};
