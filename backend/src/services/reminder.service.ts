import cron from 'node-cron';
import { taskService } from './task.service';
import { TaskType, TaskResponse } from '@smart-task/contracts';

export class ReminderService {
  /**
   * Calculate which quarter a reminder falls into
   * Quarters: 0 (at time), 25, 50, 75 (% time remaining)
   */
  private calculateReminderQuarter(
    task: TaskResponse,
    now: Date
  ): number | null {
    const currentTime = now.getTime();

    if (task.type === TaskType.REMINDER) {
      // For reminder tasks: quarters before start time
      const startTime = new Date(task.startDateTime).getTime();
      const createdTime = new Date(task.createdAt).getTime();
      const totalDuration = startTime - createdTime;
      const timeUntilStart = startTime - currentTime;

      // If task has already started, send "at time" reminder
      if (timeUntilStart <= 0) {
        return 0;
      }

      const percentRemaining = (timeUntilStart / totalDuration) * 100;

      // Determine quarter based on percentage remaining
      if (percentRemaining <= 25 && percentRemaining > 0) {
        return 25;
      } else if (percentRemaining <= 50 && percentRemaining > 25) {
        return 50;
      } else if (percentRemaining <= 75 && percentRemaining > 50) {
        return 75;
      } else if (percentRemaining > 75) {
        return 100; // 75% time remaining (not sent yet)
      }
    } else if (task.type === TaskType.DURATION) {
      // For duration tasks: quarters before deadline
      const deadlineTime = new Date(task.deadline!).getTime();
      const createdTime = new Date(task.createdAt).getTime();
      const totalDuration = deadlineTime - createdTime;
      const timeUntilDeadline = deadlineTime - currentTime;

      // If deadline has passed
      if (timeUntilDeadline <= 0) {
        return 0;
      }

      const percentRemaining = (timeUntilDeadline / totalDuration) * 100;

      // Determine quarter based on percentage remaining
      if (percentRemaining <= 25 && percentRemaining > 0) {
        return 25;
      } else if (percentRemaining <= 50 && percentRemaining > 25) {
        return 50;
      } else if (percentRemaining <= 75 && percentRemaining > 50) {
        return 75;
      } else if (percentRemaining > 75) {
        return 100; // 75% time remaining (not sent yet)
      }
    }

    return null;
  }

  /**
   * Check and send reminders for eligible tasks
   */
  async processReminders(): Promise<void> {
    try {
      const now = new Date();
      const tasks = await taskService.getTasksForReminders();

      for (const task of tasks) {
        const quarter = this.calculateReminderQuarter(task, now);

        if (quarter !== null && !task.remindersSent.includes(quarter)) {
          // Send reminder (in production, this would send email/push notification)
          await this.sendReminder(task, quarter);

          // Mark reminder as sent
          await taskService.updateReminderSent(task.id, quarter);

          console.log(
            `📬 Reminder sent for task "${task.title}" (Quarter: ${quarter}%)`
          );
        }
      }
    } catch (error) {
      console.error('Error processing reminders:', error);
    }
  }

  /**
   * Send a reminder notification
   * In production, this would integrate with email service or push notifications
   */
  private async sendReminder(task: TaskResponse, quarter: number): Promise<void> {
    const message = this.buildReminderMessage(task, quarter);

    // TODO: Integrate with actual notification service
    // For now, just log to console
    console.log(`\n========== REMINDER ==========`);
    console.log(`Task: ${task.title}`);
    console.log(`Type: ${task.type}`);
    console.log(`Priority: ${task.priority.toUpperCase()}`);
    console.log(`Message: ${message}`);
    console.log(`==============================\n`);

    // In production, you would call:
    // await emailService.send(...)
    // await pushNotificationService.send(...)
  }

  /**
   * Build reminder message based on task type and quarter
   */
  private buildReminderMessage(task: TaskResponse, quarter: number): string {
    if (task.type === TaskType.REMINDER) {
      const startTime = new Date(task.startDateTime);

      if (quarter === 0) {
        return `Your task "${task.title}" is starting now! (${startTime.toLocaleString()})`;
      } else {
        return `Reminder: Your task "${task.title}" starts at ${startTime.toLocaleString()}. (${quarter}% time remaining)`;
      }
    } else {
      // Duration task
      const deadline = new Date(task.deadline!);

      if (quarter === 0) {
        return `Deadline alert! Your task "${task.title}" is due now! (${deadline.toLocaleString()})`;
      } else if (quarter === 25) {
        return `⚠️ Urgent: Your task "${task.title}" is due soon! Deadline: ${deadline.toLocaleString()} (25% time remaining)`;
      } else if (quarter === 50) {
        return `Reminder: Your task "${task.title}" is halfway to deadline. Due: ${deadline.toLocaleString()} (50% time remaining)`;
      } else {
        return `Reminder: Your task "${task.title}" has a deadline approaching. Due: ${deadline.toLocaleString()} (${quarter}% time remaining)`;
      }
    }
  }
}

const reminderService = new ReminderService();

/**
 * Start the reminder service with cron job
 * Runs every 5 minutes
 */
export const startReminderService = (): void => {
  console.log('🔔 Starting reminder service...');

  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Checking for reminders...');
    await reminderService.processReminders();
  });

  // Also run immediately on startup
  reminderService.processReminders();
};
