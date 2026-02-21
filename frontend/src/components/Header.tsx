import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '@/api/tasks';
import { projectApi } from '@/api/projects';
import { useAuth } from '@/context/AuthContext';
import { Breadcrumbs } from './Breadcrumbs';
import ThemeToggle from './ThemeToggle';

interface SearchResult {
  type: 'task' | 'project' | 'page';
  id: string;
  title: string;
  path?: string;
  metadata?: {
    priority?: string;
    status?: string;
    description?: string;
  };
}

export const Header: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Fetch tasks and projects for search - only if authenticated
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.getTasks(),
    enabled: isAuthenticated,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getProjects(),
    enabled: isAuthenticated,
  });

  // Search through tasks, projects, and pages
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search pages
    const pages = [
      { id: 'dashboard', title: 'Dashboard', path: '/dashboard' },
      { id: 'projects', title: 'Projects', path: '/projects' },
      { id: 'calendar', title: 'Calendar', path: '/calendar' },
      { id: 'analytics', title: 'Analytics', path: '/analytics' },
    ];

    pages.forEach(page => {
      if (page.title.toLowerCase().includes(query)) {
        results.push({ type: 'page', ...page });
      }
    });

    // Search tasks
    tasks.forEach(task => {
      if (task.title.toLowerCase().includes(query)) {
        results.push({
          type: 'task',
          id: task.id,
          title: task.title,
          path: `/dashboard?taskId=${task.id}`,
          metadata: {
            priority: task.priority,
            status: task.status || 'pending',
          },
        });
      }
    });

    // Search projects
    projects.forEach(project => {
      if (project.name.toLowerCase().includes(query)) {
        results.push({
          type: 'project',
          id: project.id,
          title: project.name,
          path: `/projects?projectId=${project.id}`,
          metadata: {
            description: project.description,
          },
        });
      }
    });

    return results.slice(0, 10); // Limit to 10 results
  }, [searchQuery, tasks, projects]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-open search results when typing
  useEffect(() => {
    if (searchQuery.trim() && searchResults.length > 0) {
      setIsSearchOpen(true);
    } else if (!searchQuery.trim()) {
      setIsSearchOpen(false);
    }
  }, [searchQuery, searchResults]);

  const handleResultClick = (result: SearchResult) => {
    if (result.path) {
      navigate(result.path);
    }
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'task': return '✓';
      case 'project': return '📁';
      case 'page': return '📄';
      default: return '🔍';
    }
  };

  const getResultTypeColor = (type: string) => {
    switch (type) {
      case 'task': return 'text-accent-600 dark:text-accent-400';
      case 'project': return 'text-primary-600 dark:text-primary-400';
      case 'page': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-500 dark:text-gray-500';
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-6 fixed top-0 right-0 left-64 z-30">
      <div className="flex items-center justify-between w-full">
        {/* Left: Breadcrumbs */}
        <div className="flex-shrink-0">
          <Breadcrumbs />
        </div>

        {/* Center: Global Search */}
        <div className="flex-1 max-w-2xl mx-8 relative" ref={searchRef}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && searchResults.length > 0 && setIsSearchOpen(true)}
              placeholder="Search tasks, projects... (Ctrl+K)"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 
                border border-gray-200 dark:border-gray-600 rounded-lg
                text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                transition-all duration-200"
            />
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 
              border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl 
              max-h-96 overflow-y-auto z-50">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center space-x-3 px-4 py-3 
                    hover:bg-gray-50 dark:hover:bg-gray-700/50 
                    transition-colors border-b border-gray-100 dark:border-gray-700 
                    last:border-b-0 text-left"
                >
                  <span className="text-xl">{getResultIcon(result.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {result.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={`text-xs capitalize ${getResultTypeColor(result.type)}`}>
                        {result.type}
                      </p>
                      {result.metadata?.priority && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          result.metadata.priority === 'high' 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : result.metadata.priority === 'medium'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}>
                          {result.metadata.priority}
                        </span>
                      )}
                      {result.metadata?.status && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          • {result.metadata.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs">→</span>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {isSearchOpen && searchQuery && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 
              border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 z-50">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                No results found for "{searchQuery}"
              </p>
            </div>
          )}
        </div>

        {/* Right: Theme Toggle */}
        <div className="flex items-center space-x-4">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
