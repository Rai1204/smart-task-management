import React, { useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { TaskResponse, Priority, TaskStatus, TaskType } from '@smart-task/contracts';

interface TimelineViewProps {
  tasks: TaskResponse[];
  onTaskClick?: (task: TaskResponse) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ tasks, onTaskClick }) => {
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 0 }), []);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.HIGH:
        return 'bg-red-500 border-red-600 text-white';
      case Priority.MEDIUM:
        return 'bg-yellow-500 border-yellow-600 text-white';
      case Priority.LOW:
        return 'bg-green-500 border-green-600 text-white';
    }
  };

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      const taskDate = parseISO(task.startDateTime);
      return isSameDay(taskDate, day) && task.status !== TaskStatus.COMPLETED;
    });
  };

  const getTaskPosition = (task: TaskResponse) => {
    const taskDate = parseISO(task.startDateTime);
    const hour = taskDate.getHours();
    const minutes = taskDate.getMinutes();
    const top = ((hour + minutes / 60) / 24) * 100;
    
    // Calculate height based on duration
    let height = 4; // Default 1 hour = ~4.16%
    if (task.type === TaskType.DURATION && task.deadline) {
      const startDate = parseISO(task.startDateTime);
      const endDate = parseISO(task.deadline);
      const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      // Only use duration if it's within the same day
      if (durationHours > 0 && durationHours <= 24) {
        height = (durationHours / 24) * 100;
      }
    }
    
    return { top: `${top}%`, height: `${Math.max(height, 3)}%` };
  };

  const getTaskDuration = (task: TaskResponse): string | null => {
    if (task.type === TaskType.DURATION && task.deadline) {
      const startDate = parseISO(task.startDateTime);
      const endDate = parseISO(task.deadline);
      const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      if (durationHours > 0 && durationHours <= 24) {
        return `${durationHours.toFixed(1)}h`;
      }
    }
    return null;
  };

  const formatTime = (task: TaskResponse) => {
    const taskDate = parseISO(task.startDateTime);
    return format(taskDate, 'h:mm a');
  };

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="card-glass">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">📅 Week Timeline</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Visual representation of your scheduled tasks</p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header - Days of week */}
          <div className="grid grid-cols-8 border-b-2 border-gray-300 dark:border-gray-600">
            <div className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400">Time</div>
            {weekDays.map((day, index) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={index}
                  className={`p-2 text-center border-l border-gray-200 dark:border-gray-700 ${
                    isToday ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <div className={`text-xs font-medium ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                    {format(day, 'd')}
                  </div>
                  {isToday && (
                    <div className="text-xs text-primary-600 dark:text-primary-400 font-semibold">Today</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Timeline Grid */}
          <div className="relative">
            <div className="grid grid-cols-8">
              {/* Hours column */}
              <div className="border-r border-gray-200 dark:border-gray-700">
                {hours.map(hour => (
                  <div
                    key={hour}
                    className="h-16 border-b border-gray-100 dark:border-gray-800 flex items-center justify-end pr-2"
                  >
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {format(new Date().setHours(hour, 0), 'ha')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Days columns with task blocks */}
              {weekDays.map((day, dayIndex) => {
                const dayTasks = getTasksForDay(day);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div
                    key={dayIndex}
                    className={`relative border-l border-gray-200 dark:border-gray-700 ${
                      isToday ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''
                    }`}
                  >
                    {/* Hour grid lines */}
                    {hours.map(hour => (
                      <div
                        key={hour}
                        className="h-16 border-b border-gray-100 dark:border-gray-800"
                      />
                    ))}

                    {/* Task blocks */}
                    <div className="absolute inset-0 p-1">
                      {dayTasks.map((task) => {
                        const position = getTaskPosition(task);
                        const duration = getTaskDuration(task);
                        return (
                          <div
                            key={task.id}
                            className={`absolute left-1 right-1 ${getPriorityColor(task.priority)} 
                              rounded border-l-4 shadow-md hover:shadow-lg transition-all cursor-pointer
                              overflow-hidden z-10`}
                            style={{
                              top: position.top,
                              height: position.height,
                              minHeight: '40px',
                              maxHeight: '200px',
                            }}
                            onClick={() => onTaskClick?.(task)}
                            title={`${task.title}\n${formatTime(task)} ${duration ? `- ${duration}` : ''}`}
                          >
                            <div className="p-2 h-full flex flex-col justify-between">
                              <div className="text-xs font-bold leading-tight">
                                {truncateText(task.title, 20)}
                              </div>
                              <div className="text-[10px] opacity-90 mt-1">
                                {formatTime(task)}
                                {duration && ` • ${duration}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Current time indicator (only for today) */}
                    {isToday && (() => {
                      const now = new Date();
                      const currentHour = now.getHours();
                      const currentMinutes = now.getMinutes();
                      const top = ((currentHour + currentMinutes / 60) / 24) * 100;
                      
                      return (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none"
                          style={{ top: `${top}%` }}
                        >
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                            <div className="flex-1 h-0.5 bg-accent-500"></div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 border-2 border-red-600 rounded"></div>
          <span className="text-gray-700 dark:text-gray-300">High Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 border-2 border-yellow-600 rounded"></div>
          <span className="text-gray-700 dark:text-gray-300">Medium Priority</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 border-2 border-green-600 rounded"></div>
          <span className="text-gray-700 dark:text-gray-300">Low Priority</span>
        </div>
      </div>
    </div>
  );
};
