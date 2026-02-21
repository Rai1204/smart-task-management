import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface Breadcrumb {
  label: string;
  path: string;
}

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  calendar: 'Calendar',
  analytics: 'Analytics',
};

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  
  const getBreadcrumbs = (): Breadcrumb[] => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: Breadcrumb[] = [];
    
    let currentPath = '';
    paths.forEach((path) => {
      currentPath += `/${path}`;
      const label = routeLabels[path] || path.charAt(0).toUpperCase() + path.slice(1);
      breadcrumbs.push({ label, path: currentPath });
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm" aria-label="Breadcrumb">
      <Link
        to="/"
        className="text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        🏠
      </Link>
      
      {breadcrumbs.map((breadcrumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        return (
          <React.Fragment key={breadcrumb.path}>
            <span className="text-gray-400 dark:text-gray-600">/</span>
            {isLast ? (
              <span className="font-medium text-gray-900 dark:text-white">
                {breadcrumb.label}
              </span>
            ) : (
              <Link
                to={breadcrumb.path}
                className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {breadcrumb.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
