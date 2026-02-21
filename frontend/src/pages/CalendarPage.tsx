import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '@/api/tasks';
import { MainLayout } from '@/components/MainLayout';
import { TaskResponse, TaskStatus } from '@smart-task/contracts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, parseISO } from 'date-fns';

export const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.getTasks(),
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get tasks for a specific day
  const getTasksForDay = (day: Date): TaskResponse[] => {
    return tasks.filter(task => {
      const taskDate = parseISO(task.startDateTime);
      return isSameDay(taskDate, day);
    });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get first day of month to calculate offset
  const firstDayOfWeek = monthStart.getDay();

  return (
    <MainLayout showFAB={false}>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendar</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View and manage your tasks in calendar view
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousMonth}
              className="btn btn-secondary"
            >
              ← Prev
            </button>
            <button
              onClick={goToToday}
              className="btn btn-primary"
            >
              Today
            </button>
            <button
              onClick={goToNextMonth}
              className="btn btn-secondary"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Month/Year Display */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                className="py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 auto-rows-fr min-h-[600px]">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: firstDayOfWeek }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="border-r border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              />
            ))}

            {/* Actual days */}
            {daysInMonth.map(day => {
              const dayTasks = getTasksForDay(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={`border-r border-b border-gray-200 dark:border-gray-700 p-2 cursor-pointer
                    hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                    ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
                    ${isTodayDate ? 'border-2 border-primary-500' : ''}
                  `}
                >
                  {/* Day Number */}
                  <div
                    className={`text-sm font-semibold mb-1 ${
                      isTodayDate
                        ? 'bg-primary-500 text-white w-6 h-6 rounded-full flex items-center justify-center'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>

                  {/* Task indicators */}
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map(task => (
                      <div
                        key={task.id}
                        className={`text-xs px-1.5 py-0.5 rounded truncate ${
                          task.status === TaskStatus.COMPLETED
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}
                        title={task.title}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details */}
        {selectedDate && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Tasks for {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
            {getTasksForDay(selectedDate).length > 0 ? (
              <div className="space-y-2">
                {getTasksForDay(selectedDate).map(task => (
                  <div
                    key={task.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {task.title}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          task.status === TaskStatus.COMPLETED
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {task.status || 'Pending'}
                      </span>
                    </div>
                    {task.deadline && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Due: {format(parseISO(task.deadline), 'h:mm a')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No tasks for this day</p>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
