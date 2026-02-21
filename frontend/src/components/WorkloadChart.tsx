import React, { useEffect } from 'react';
import { taskApi } from '@/api/tasks';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

interface DailyWorkload {
  date: string;
  totalHours: number;
  taskCount: number;
  tasks: {
    id: string;
    title: string;
    hours: number;
    priority: string;
    status: string;
  }[];
}

interface WorkloadSummary {
  dailyWorkloads: DailyWorkload[];
  weekTotal: number;
  averagePerDay: number;
  busiestDay: string;
  maxHoursPerDay: number;
}

export const WorkloadChart: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const {
    data: workload,
    isLoading: loading,
    isError,
  } = useQuery<WorkloadSummary>({
    queryKey: ['workload', 'current-week'],
    queryFn: () => taskApi.getCurrentWeekWorkload(),
    enabled: isAuthenticated,
    retry: 1,
  });

  useEffect(() => {
    if (isError) {
      toast.error('Failed to load workload data');
    }
  }, [isError]);

  if (isError) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getBarHeight = (hours: number, maxHours: number) => {
    if (maxHours === 0) return 0;
    return Math.min((hours / Math.max(maxHours, 8)) * 100, 100);
  };

  const getBarColor = (hours: number) => {
    if (hours <= 4) return 'bg-gray-400 dark:bg-gray-500';
    if (hours <= 8) return 'bg-primary-400 dark:bg-primary-500';
    if (hours <= 10) return 'bg-primary-600 dark:bg-primary-500';
    return 'bg-accent-600 dark:bg-accent-500';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!workload) {
    return null;
  }

  const maxDisplayHours = Math.max(workload.maxHoursPerDay, 8);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">📊 This Week's Workload</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Hours:</span>
            <span className="ml-2 font-semibold text-blue-600">{workload.weekTotal.toFixed(1)}h</span>
          </div>
          <div>
            <span className="text-gray-600">Daily Average:</span>
            <span className="ml-2 font-semibold text-blue-600">{workload.averagePerDay.toFixed(1)}h</span>
          </div>
          <div>
            <span className="text-gray-600">Busiest Day:</span>
            <span className="ml-2 font-semibold text-blue-600">
              {formatDate(workload.busiestDay)} ({workload.maxHoursPerDay.toFixed(1)}h)
            </span>
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-500">
          <span>{maxDisplayHours.toFixed(0)}h</span>
          <span>{(maxDisplayHours * 0.75).toFixed(0)}h</span>
          <span>{(maxDisplayHours * 0.5).toFixed(0)}h</span>
          <span>{(maxDisplayHours * 0.25).toFixed(0)}h</span>
          <span>0h</span>
        </div>

        {/* Chart area */}
        <div className="ml-14 relative h-64 border-l-2 border-b-2 border-gray-300">
          {/* 8-hour reference line */}
          <div className="absolute left-0 right-0 border-t-2 border-dashed border-red-300" style={{ bottom: `${(8 / maxDisplayHours) * 100}%` }}>
            <span className="absolute -top-2 -right-0 text-xs text-red-500 bg-white px-1">8h limit</span>
          </div>

          {/* Bars */}
          <div className="h-full flex items-end justify-around px-2">
            {workload.dailyWorkloads.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center px-1 group relative">
                {/* Bar */}
                <div className="w-full max-w-[60px] relative">
                  <div
                    className={`w-full ${getBarColor(day.totalHours)} rounded-t transition-all duration-300 hover:opacity-80`}
                    style={{ height: `${getBarHeight(day.totalHours, maxDisplayHours) * 2.56}px` }}
                  >
                    {day.totalHours > 0 && (
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full text-xs font-semibold">
                        {day.totalHours.toFixed(1)}h
                      </div>
                    )}
                  </div>
                </div>

                {/* Day label */}
                <div className="mt-2 text-xs text-center">
                  <div className="font-medium">{formatDate(day.date).split(',')[0]}</div>
                  <div className="text-gray-500">{day.taskCount} task{day.taskCount !== 1 ? 's' : ''}</div>
                </div>

                {/* Tooltip on hover */}
                {day.tasks.length > 0 && (
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded p-2 shadow-lg z-10 w-48">
                    <div className="font-semibold mb-1">{formatDate(day.date)}</div>
                    {day.tasks.map((task, taskIndex) => (
                      <div key={taskIndex} className="flex justify-between py-1 border-b border-gray-700 last:border-0">
                        <span className={`truncate pr-2 ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>
                          {task.status === 'completed' ? '✓ ' : ''}
                          {task.title}
                        </span>
                        <span className="text-gray-300">{task.hours.toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded"></div>
          <span>Light (≤4h)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary-400 dark:bg-primary-500 rounded"></div>
          <span>Moderate (4-8h)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-primary-600 dark:bg-primary-500 rounded"></div>
          <span>Heavy (8-10h)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-accent-600 dark:bg-accent-500 rounded"></div>
          <span>Overloaded ({'>'}10h)</span>
        </div>
      </div>

      {/* Warning if overcommitted */}
      {workload.maxHoursPerDay > 8 && (
        <div className="mt-4 p-3 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-700 rounded text-sm text-accent-800 dark:text-accent-300">
          ⚠️ <span className="font-semibold">Warning:</span> You're scheduled for {workload.maxHoursPerDay.toFixed(1)} hours on{' '}
          {formatDate(workload.busiestDay)}. Consider rescheduling some tasks to avoid burnout.
        </div>
      )}
    </div>
  );
};
