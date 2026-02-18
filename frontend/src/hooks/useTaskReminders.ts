import { useEffect, useRef } from 'react';
import { TaskResponse, TaskType } from '@smart-task/contracts';
import toast from 'react-hot-toast';

export const useTaskReminders = (tasks: TaskResponse[] | undefined) => {
  const notifiedTasksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    const checkReminders = () => {
      const now = new Date();
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

      tasks.forEach((task) => {
        // Only check tasks with reminders enabled
        if (!task.reminderEnabled) return;

        // Skip if already notified
        const notificationKey = `${task.id}-upcoming`;
        if (notifiedTasksRef.current.has(notificationKey)) return;

        const taskTime = new Date(
          task.type === TaskType.REMINDER ? task.startDateTime : task.deadline!
        );

        // Check if task is within next 15 minutes
        if (taskTime > now && taskTime <= fifteenMinutesFromNow) {
          const minutesUntil = Math.round((taskTime.getTime() - now.getTime()) / 60000);
          
          toast(
            `⏰ Reminder: "${task.title}" ${task.type === TaskType.REMINDER ? 'starts' : 'is due'} in ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}!`,
            {
              icon: task.priority === 'high' ? '🔥' : '⏰',
              duration: 10000,
              style: {
                background: task.priority === 'high' ? '#fee2e2' : '#dbeafe',
                border: task.priority === 'high' ? '2px solid #ef4444' : '2px solid #3b82f6',
              },
            }
          );

          // Mark as notified
          notifiedTasksRef.current.add(notificationKey);
        }

        // Check if task is overdue
        if (taskTime < now) {
          const overdueKey = `${task.id}-overdue`;
          if (!notifiedTasksRef.current.has(overdueKey)) {
            toast.error(
              `⚠️ Overdue: "${task.title}" was ${task.type === TaskType.REMINDER ? 'scheduled for' : 'due at'} ${taskTime.toLocaleTimeString()}`,
              { duration: 8000 }
            );
            notifiedTasksRef.current.add(overdueKey);
          }
        }
      });
    };

    // Check immediately
    checkReminders();

    // Check every minute
    const interval = setInterval(checkReminders, 60000);

    return () => clearInterval(interval);
  }, [tasks]);
};
