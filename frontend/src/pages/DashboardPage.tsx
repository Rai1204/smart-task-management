import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { taskApi } from '@/api/tasks';
import { useAuth } from '@/context/AuthContext';
import { TaskCard } from '@/components/TaskCard';
import { TaskForm } from '@/components/TaskForm';
import { WorkloadChart } from '@/components/WorkloadChart';
import { TimelineView } from '@/components/TimelineView';
import { MainLayout } from '@/components/MainLayout';
import { useTaskReminders } from '@/hooks/useTaskReminders';
import { TaskResponse, TaskStatus, TaskType, Priority } from '@smart-task/contracts';
import toast from 'react-hot-toast';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null);
  const [filterType, setFilterType] = useState<TaskType | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'priority'>('priority');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.getTasks(),
  });

  // Enable in-app reminders for upcoming tasks
  useTaskReminders(tasks);

  // Handle opening task from URL params (e.g., from search)
  useEffect(() => {
    const taskId = searchParams.get('taskId');
    if (taskId && tasks.length > 0) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setEditingTask(task);
        setShowTaskForm(true);
        // Clear the URL param after opening
        setSearchParams({});
      }
    }
  }, [searchParams, tasks, setSearchParams]);

  const deleteTaskMutation = useMutation({
    mutationFn: taskApi.deleteTask,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['projects'] });
      toast.success('Task deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete task');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      taskApi.updateTask(id, { status }),
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      
      // Set updating state immediately
      setUpdatingTaskId(id);
      
      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<TaskResponse[]>(['tasks']);
      
      // Check if this is a recurring completion (don't optimistically update - backend will change it)
      const task = previousTasks?.find(t => t.id === id);
      const isRecurringCompletion = task?.isRecurring && status === TaskStatus.COMPLETED;
      
      if (!isRecurringCompletion) {
        // Optimistically update the cache for non-recurring completions
        queryClient.setQueryData<TaskResponse[]>(['tasks'], (old) => 
          old?.map(t => t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t) || []
        );
      }
      
      return { previousTasks, id, isRecurringCompletion };
    },
    onSuccess: (updatedTask, _variables, context) => {
      if (context?.isRecurringCompletion) {
        // For recurring completions, backend auto-advances - need full refetch
        queryClient.refetchQueries({ queryKey: ['tasks'] });
        queryClient.refetchQueries({ queryKey: ['projects'] });
        toast.success('Moved to next occurrence!', { icon: '🔄' });
      } else {
        // For regular updates, just update the specific task in cache
        queryClient.setQueryData<TaskResponse[]>(['tasks'], (old) => 
          old?.map(t => t.id === updatedTask.id ? updatedTask : t) || []
        );
        // Also refetch projects to update task counts
        queryClient.refetchQueries({ queryKey: ['projects'] });
        toast.success('Status updated');
      }
    },
    onError: (_error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
      toast.error('Failed to update status');
    },
    onSettled: () => {
      // Clear updating state after a brief delay to smooth transitions
      setTimeout(() => setUpdatingTaskId(null), 100);
    },
  });

  // Store mutation functions in refs to keep callbacks stable
  const deleteTaskMutationRef = useRef(deleteTaskMutation);
  const updateStatusMutationRef = useRef(updateStatusMutation);
  
  useEffect(() => {
    deleteTaskMutationRef.current = deleteTaskMutation;
    updateStatusMutationRef.current = updateStatusMutation;
  }, [deleteTaskMutation, updateStatusMutation]);

  const handleDeleteTask = useCallback((taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      deleteTaskMutationRef.current.mutate(taskId);
    }
  }, []);

  const handleStatusChange = useCallback((taskId: string, status: TaskStatus) => {
    updateStatusMutationRef.current.mutate({ id: taskId, status });
  }, []);

  const handleEditTask = useCallback((task: TaskResponse) => {
    setEditingTask(task);
    setShowTaskForm(true);
  }, []);

  const handleCloseTaskForm = useCallback(() => {
    setShowTaskForm(false);
    setEditingTask(null);
  }, []);

  const handleNewTask = useCallback(() => {
    setEditingTask(null);
    setShowTaskForm(true);
  }, []);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterType !== 'all' && task.type !== filterType) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterStatus !== 'all') {
      // Handle tasks without status (treat as pending)
      const taskStatus = task.status || TaskStatus.PENDING;
      if (taskStatus !== filterStatus) return false;
    }
    return true;
  });

  // Dynamic priority calculation
  const calculateDynamicPriority = useCallback((task: TaskResponse): number => {
    const priorityScores = { [Priority.LOW]: 1, [Priority.MEDIUM]: 2, [Priority.HIGH]: 3 };
    let score = priorityScores[task.priority] * 10;

    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilDeadline < 0) score += 100; // Overdue
      else if (hoursUntilDeadline < 2) score += 50; // Critical
      else if (hoursUntilDeadline < 6) score += 30; // Very urgent
      else if (hoursUntilDeadline < 24) score += 20; // Urgent
      else if (hoursUntilDeadline < 48) score += 10; // Moderately urgent
      else if (hoursUntilDeadline < 168) score += 5; // Within a week
    }

    if (task.status === TaskStatus.IN_PROGRESS) score += 15;
    if (task.status === TaskStatus.COMPLETED) score = -1000;

    return score;
  }, []);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    
    if (sortBy === 'priority') {
      return sorted.sort((a, b) => calculateDynamicPriority(b) - calculateDynamicPriority(a));
    } else {
      return sorted.sort((a, b) => 
        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
      );
    }
  }, [filteredTasks, sortBy, calculateDynamicPriority]);

  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (t) => t.status === TaskStatus.COMPLETED
  ).length;
  const pendingTasks = tasks.filter(
    (t) => t.status === TaskStatus.PENDING || !t.status
  ).length;
  const highPriorityTasks = tasks.filter((t) => t.priority === Priority.HIGH).length;

  return (
    <MainLayout onNewTask={handleNewTask} showFAB={true}>
      {/* Welcome Message */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name}! 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Let's manage your tasks efficiently
        </p>
      </div>
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
          {/* Total Tasks - Primary Indigo */}
          <div className="card-glass bg-gradient-to-br from-primary-500 to-primary-600 text-white animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{totalTasks}</div>
                <div className="text-primary-100 text-sm mt-1">Total Tasks</div>
              </div>
              <div className="text-4xl opacity-50">📋</div>
            </div>
          </div>
          
          {/* Completed - Accent Teal */}
          <div className="card-glass bg-gradient-to-br from-accent-500 to-accent-600 text-white animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold">{completedTasks}</div>
                <div className="text-accent-100 text-sm mt-1">Completed</div>
              </div>
              <div className="text-4xl opacity-50">✓</div>
            </div>
          </div>
          
          {/* Pending - Neutral with Primary accent */}
          <div className="card-glass bg-white dark:bg-gray-800 border-2 border-primary-200 dark:border-primary-700 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{pendingTasks}</div>
                <div className="text-gray-600 dark:text-gray-400 text-sm mt-1">Pending</div>
              </div>
              <div className="text-4xl opacity-30">⏳</div>
            </div>
          </div>
          
          {/* High Priority - Neutral with Accent */}
          <div className="card-glass bg-white dark:bg-gray-800 border-2 border-accent-200 dark:border-accent-700 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-accent-600 dark:text-accent-400">{highPriorityTasks}</div>
                <div className="text-gray-600 dark:text-gray-400 text-sm mt-1">High Priority</div>
              </div>
              <div className="text-4xl opacity-30">⚡</div>
            </div>
          </div>
        </div>

        {/* Workload Chart */}
        <div className="mb-6">
          <WorkloadChart />
        </div>

        {/* Actions & Filters */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  📋 List
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                    viewMode === 'timeline'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  📅 Timeline
                </button>
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Types</option>
                <option value={TaskType.REMINDER}>Reminder Tasks</option>
                <option value={TaskType.DURATION}>Duration Tasks</option>
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Priorities</option>
                <option value={Priority.HIGH}>High</option>
                <option value={Priority.MEDIUM}>Medium</option>
                <option value={Priority.LOW}>Low</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Statuses</option>
                <option value={TaskStatus.PENDING}>Pending</option>
                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                <option value={TaskStatus.COMPLETED}>Completed</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium"
              >
                <option value="priority">🎯 Sort by Smart Priority</option>
                <option value="time">🕒 Sort by Time</option>
              </select>
            </div>
            <button
              onClick={() => setShowTaskForm(true)}
              className="btn btn-primary"
            >
              + Create Task
            </button>
          </div>
        </div>

        {/* Tasks Display - Timeline or List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Loading tasks...</p>
          </div>
        ) : viewMode === 'timeline' ? (
          <TimelineView 
            tasks={tasks} 
            onTaskClick={(task) => {
              setEditingTask(task);
              setShowTaskForm(true);
            }}
          />
        ) : sortedTasks.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-white mb-2">
              No tasks found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {tasks.length === 0
                ? 'Create your first task to get started!'
                : 'Try adjusting your filters'}
            </p>
            {tasks.length === 0 && (
              <button
                onClick={() => setShowTaskForm(true)}
                className="btn btn-primary"
              >
                Create Your First Task
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onStatusChange={handleStatusChange}
                isUpdating={updatingTaskId === task.id}
              />
            ))}
          </div>
        )}

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          task={editingTask}
          onClose={handleCloseTaskForm}
          onSuccess={handleCloseTaskForm}
        />
      )}
    </MainLayout>
  );
};
