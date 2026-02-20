import { TaskModel } from '../models/task.model.js';
import { TaskType, TaskStatus } from '@smart-task/contracts';

export interface DailyWorkload {
  date: string; // ISO date string (YYYY-MM-DD)
  totalHours: number;
  taskCount: number;
  tasks: {
    id: string;
    title: string;
    hours: number;
    priority: string;
  }[];
}

export interface WorkloadSummary {
  dailyWorkloads: DailyWorkload[];
  weekTotal: number;
  averagePerDay: number;
  busiestDay: string;
  maxHoursPerDay: number;
}

export class WorkloadService {
  /**
   * Calculate workload for a specific date range
   */
  async calculateWorkload(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WorkloadSummary> {
    // Fetch all DURATION (Project) tasks within the date range
    const tasks = await TaskModel.find({
      userId,
      type: TaskType.DURATION,
      status: { $ne: TaskStatus.COMPLETED },
      startDateTime: { $lte: endDate },
      deadline: { $gte: startDate },
    }).sort({ startDateTime: 1 });

    // Group tasks by date and calculate hours
    const dailyMap = new Map<string, DailyWorkload>();

    for (const task of tasks) {
      const taskStart = new Date(task.startDateTime);
      const taskEnd = task.deadline ? new Date(task.deadline) : taskStart;
      
      // Calculate task duration in hours
      const durationMs = taskEnd.getTime() - taskStart.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      // Get the date string for the task start (YYYY-MM-DD)
      const dateKey = taskStart.toISOString().split('T')[0];

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          totalHours: 0,
          taskCount: 0,
          tasks: [],
        });
      }

      const daily = dailyMap.get(dateKey)!;
      daily.totalHours += durationHours;
      daily.taskCount += 1;
      daily.tasks.push({
        id: task.id,
        title: task.title,
        hours: durationHours,
        priority: task.priority,
      });
    }

    // Fill in missing dates with zero workload
    const dailyWorkloads: DailyWorkload[] = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      
      if (dailyMap.has(dateKey)) {
        dailyWorkloads.push(dailyMap.get(dateKey)!);
      } else {
        dailyWorkloads.push({
          date: dateKey,
          totalHours: 0,
          taskCount: 0,
          tasks: [],
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate summary statistics
    const weekTotal = dailyWorkloads.reduce((sum, day) => sum + day.totalHours, 0);
    const averagePerDay = weekTotal / dailyWorkloads.length;
    
    const busiestDayData = dailyWorkloads.reduce((max, day) => 
      day.totalHours > max.totalHours ? day : max
    , dailyWorkloads[0]);
    
    const busiestDay = busiestDayData.date;
    const maxHoursPerDay = busiestDayData.totalHours;

    return {
      dailyWorkloads,
      weekTotal,
      averagePerDay,
      busiestDay,
      maxHoursPerDay,
    };
  }

  /**
   * Get current week workload (Mon-Sun)
   */
  async getCurrentWeekWorkload(userId: string): Promise<WorkloadSummary> {
    const now = new Date();
    
    // Get Monday of current week
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    
    // Get Sunday of current week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return this.calculateWorkload(userId, monday, sunday);
  }

  /**
   * Check if user is overcommitted on a specific date
   */
  async checkOvercommitment(
    userId: string,
    date: Date,
    maxHoursPerDay: number = 8
  ): Promise<{ isOvercommitted: boolean; hours: number; message: string }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dayWorkload = await this.calculateWorkload(userId, startOfDay, endOfDay);
    const hours = dayWorkload.dailyWorkloads[0]?.totalHours || 0;
    
    const isOvercommitted = hours > maxHoursPerDay;
    const message = isOvercommitted
      ? `⚠️ You have ${hours.toFixed(1)} hours scheduled. Consider rescheduling some tasks.`
      : `✅ You have ${hours.toFixed(1)} hours scheduled (${maxHoursPerDay - hours} hours available).`;

    return {
      isOvercommitted,
      hours,
      message,
    };
  }
}
