import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '@/api/tasks';
import { projectApi } from '@/api/projects';
import { MainLayout } from '@/components/MainLayout';
import { TaskStatus, Priority, TaskType } from '@smart-task/contracts';
import { parseISO, isAfter, isBefore, addDays } from 'date-fns';

export const AnalyticsPage: React.FC = () => {
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.getTasks(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getProjects(),
  });

  // Calculate analytics
  const analytics = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
    const pendingTasks = tasks.filter(t => !t.status || t.status === TaskStatus.PENDING).length;
    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Priority breakdown
    const highPriority = tasks.filter(t => t.priority === Priority.HIGH).length;
    const mediumPriority = tasks.filter(t => t.priority === Priority.MEDIUM).length;
    const lowPriority = tasks.filter(t => t.priority === Priority.LOW).length;

    // Task type breakdown
    const reminderTasks = tasks.filter(t => t.type === TaskType.REMINDER).length;
    const durationTasks = tasks.filter(t => t.type === TaskType.DURATION).length;

    // Overdue tasks
    const overdueTasks = tasks.filter(t => {
      if (t.status === TaskStatus.COMPLETED) return false;
      if (!t.deadline) return false;
      return isBefore(parseISO(t.deadline), now);
    }).length;

    // Upcoming tasks (next 7 days)
    const upcomingTasks = tasks.filter(t => {
      if (!t.startDateTime) return false;
      const taskDate = parseISO(t.startDateTime);
      return isAfter(taskDate, now) && isBefore(taskDate, weekFromNow);
    }).length;

    // Project with most tasks
    const projectTaskCounts = projects.map(project => ({
      name: project.name,
      count: tasks.filter(t => t.projectId === project.id).length,
    }));
    const mostActiveProjec = projectTaskCounts.sort((a, b) => b.count - a.count)[0];

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      completionRate,
      highPriority,
      mediumPriority,
      lowPriority,
      reminderTasks,
      durationTasks,
      overdueTasks,
      upcomingTasks,
      mostActiveProject: mostActiveProjec,
      totalProjects: projects.length,
    };
  }, [tasks, projects]);

  return (
    <MainLayout showFAB={false}>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Insights and statistics about your tasks and productivity
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-lg p-6 shadow-lg">
            <div className="text-4xl font-bold">{analytics.totalTasks}</div>
            <div className="text-primary-100 text-sm mt-1">Total Tasks</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
            <div className="text-4xl font-bold">{analytics.completedTasks}</div>
            <div className="text-green-100 text-sm mt-1">Completed</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg p-6 shadow-lg">
            <div className="text-4xl font-bold">{analytics.pendingTasks}</div>
            <div className="text-yellow-100 text-sm mt-1">Pending</div>
          </div>
          <div className="bg-gradient-to-br from-accent-500 to-accent-600 text-white rounded-lg p-6 shadow-lg">
            <div className="text-4xl font-bold">{analytics.completionRate}%</div>
            <div className="text-accent-100 text-sm mt-1">Completion Rate</div>
          </div>
        </div>

        {/* Detailed Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              📊 Priority Breakdown
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">High Priority</span>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {analytics.highPriority}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all"
                    style={{ width: `${(analytics.highPriority / analytics.totalTasks) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Medium Priority</span>
                  <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                    {analytics.mediumPriority}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full transition-all"
                    style={{ width: `${(analytics.mediumPriority / analytics.totalTasks) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Low Priority</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {analytics.lowPriority}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${(analytics.lowPriority / analytics.totalTasks) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              ✓ Status Overview
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">Completed</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {analytics.completedTasks}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">In Progress</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {analytics.inProgressTasks}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-700 dark:text-gray-300">Pending</span>
                <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {analytics.pendingTasks}
                </span>
              </div>
            </div>
          </div>

          {/* Task Types */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              📅 Task Types
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Duration Tasks</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Time-bound tasks</div>
                </div>
                <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                  {analytics.durationTasks}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-accent-50 dark:bg-accent-900/20 rounded-lg">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Reminder Tasks</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">One-time reminders</div>
                </div>
                <div className="text-3xl font-bold text-accent-600 dark:text-accent-400">
                  {analytics.reminderTasks}
                </div>
              </div>
            </div>
          </div>

          {/* Alerts & Insights */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              ⚡ Insights
            </h2>
            <div className="space-y-3">
              {analytics.overdueTasks > 0 && (
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <div className="font-semibold text-red-700 dark:text-red-300">
                      {analytics.overdueTasks} Overdue Task{analytics.overdueTasks !== 1 ? 's' : ''}
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-400">
                      Review and update your deadlines
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-2xl">📆</span>
                <div>
                  <div className="font-semibold text-blue-700 dark:text-blue-300">
                    {analytics.upcomingTasks} Upcoming Task{analytics.upcomingTasks !== 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">
                    In the next 7 days
                  </div>
                </div>
              </div>
              {analytics.mostActiveProject && (
                <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <div className="font-semibold text-purple-700 dark:text-purple-300">
                      Most Active Project
                    </div>
                    <div className="text-sm text-purple-600 dark:text-purple-400">
                      {analytics.mostActiveProject.name} ({analytics.mostActiveProject.count} tasks)
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <span className="text-2xl">📁</span>
                <div>
                  <div className="font-semibold text-green-700 dark:text-green-300">
                    Total Projects
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">
                    {analytics.totalProjects} active project{analytics.totalProjects !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
