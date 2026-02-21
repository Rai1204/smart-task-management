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
    status: string;
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
    // Fetch all DURATION (Project) tasks within the date range (including completed)
    const tasks = await TaskModel.find({
      userId,
      type: TaskType.DURATION,
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

      // Distribute hours across all days the task spans
      let currentDay = new Date(taskStart);
      currentDay.setHours(0, 0, 0, 0);
      
      const lastDay = new Date(taskEnd);
      lastDay.setHours(0, 0, 0, 0);

      while (currentDay <= lastDay) {
        // Use local date string instead of ISO to avoid timezone shifts
        const year = currentDay.getFullYear();
        const month = String(currentDay.getMonth() + 1).padStart(2, '0');
        const day = String(currentDay.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        
        // Calculate how many hours fall on this specific day
        const dayStart = new Date(currentDay);
        const dayEnd = new Date(currentDay);
        dayEnd.setHours(23, 59, 59, 999);
        
        const effectiveStart = new Date(Math.max(taskStart.getTime(), dayStart.getTime()));
        const effectiveEnd = new Date(Math.min(taskEnd.getTime(), dayEnd.getTime()));
        
        const hoursOnThisDay = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);

        if (hoursOnThisDay > 0) {
          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, {
              date: dateKey,
              totalHours: 0,
              taskCount: 0,
              tasks: [],
            });
          }

          const daily = dailyMap.get(dateKey)!;
          daily.totalHours += hoursOnThisDay;
          
          // Only count task once (on the first day it appears)
          if (currentDay.getTime() === new Date(taskStart).setHours(0, 0, 0, 0)) {
            daily.taskCount += 1;
          }
          
          daily.tasks.push({
            id: task.id,
            title: task.title,
            hours: hoursOnThisDay,
            priority: task.priority,
            status: task.status,
          });
        }
        
        // Move to next day
        currentDay.setDate(currentDay.getDate() + 1);
      }
    }

    // Fill in missing dates with zero workload and apply 24-hour cap with overflow
    const dailyWorkloads: DailyWorkload[] = [];
    let currentDate = new Date(startDate);
    let carryOverHours = 0;
    const carryOverTasks: Array<{ id: string; title: string; hours: number; priority: string; status: string }> = [];
    
    while (currentDate <= endDate) {
      // Use local date string instead of ISO to avoid timezone shifts
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      let dayData: DailyWorkload;
      if (dailyMap.has(dateKey)) {
        dayData = dailyMap.get(dateKey)!;
      } else {
        dayData = {
          date: dateKey,
          totalHours: 0,
          taskCount: 0,
          tasks: [],
        };
      }
      
      // Add any carry-over hours from previous day
      if (carryOverHours > 0) {
        dayData.totalHours += carryOverHours;
        dayData.tasks.push(...carryOverTasks);
        carryOverHours = 0;
        carryOverTasks.length = 0;
      }
      
      // Cap at 24 hours and carry over excess
      if (dayData.totalHours > 24) {
        carryOverHours = dayData.totalHours - 24;
        
        // Distribute carry-over proportionally across tasks
        const excessRatio = carryOverHours / dayData.totalHours;
        const adjustedTasks: typeof dayData.tasks = [];
        
        for (const task of dayData.tasks) {
          const carryAmount = task.hours * excessRatio;
          const remainingAmount = task.hours - carryAmount;
          
          // Keep partial hours on current day
          if (remainingAmount > 0) {
            adjustedTasks.push({
              ...task,
              hours: remainingAmount,
            });
          }
          
          // Carry over to next day
          if (carryAmount > 0) {
            carryOverTasks.push({
              ...task,
              hours: carryAmount,
            });
          }
        }
        
        dayData.tasks = adjustedTasks;
        dayData.totalHours = 24;
      }
      
      dailyWorkloads.push(dayData);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // If there's still carry-over after the end date, add an extra day
    while (carryOverHours > 0) {
      // Use local date string instead of ISO to avoid timezone shifts
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      const hours = Math.min(carryOverHours, 24);
      
      dailyWorkloads.push({
        date: dateKey,
        totalHours: hours,
        taskCount: 0,
        tasks: carryOverTasks.map(t => ({
          ...t,
          hours: Math.min(t.hours, hours),
        })),
      });
      
      carryOverHours -= hours;
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
