import { TaskResponse, RecurrenceFrequency } from '@smart-task/contracts';

/**
 * Calculate the current or next occurrence of a recurring task
 */
export function calculateCurrentOccurrence(task: TaskResponse): {
  currentDate: Date;
  isOverdue: boolean;
  isCompleted: boolean;
} {
  if (!task.isRecurring || !task.recurrencePattern) {
    return {
      currentDate: new Date(task.startDateTime),
      isOverdue: new Date(task.startDateTime) < new Date(),
      isCompleted: false,
    };
  }

  // For recurring tasks, the backend stores the current occurrence date in startDateTime
  // and manages the recurrence pattern (including decrementing occurrences)
  const startDate = new Date(task.startDateTime);
  const now = new Date();
  const pattern = task.recurrencePattern;

  // Check if series is complete
  // Backend marks task as COMPLETED when series ends
  if (task.status === 'completed') {
    return {
      currentDate: startDate,
      isOverdue: false,
      isCompleted: true,
    };
  }

  // Check if occurrence count reached 0 (shouldn't happen if backend logic is correct)
  if (pattern.occurrences !== undefined && pattern.occurrences <= 0) {
    return {
      currentDate: startDate,
      isOverdue: false,
      isCompleted: true,
    };
  }

  // Check if we've passed the end date
  if (pattern.endDate && startDate > new Date(pattern.endDate)) {
    return {
      currentDate: startDate,
      isOverdue: false,
      isCompleted: true,
    };
  }

  // If start date is in the future, return it
  if (startDate > now) {
    return {
      currentDate: startDate,
      isOverdue: false,
      isCompleted: false,
    };
  }

  // Current occurrence is overdue if it's in the past
  const isOverdue = startDate < now;

  return {
    currentDate: startDate,
    isOverdue,
    isCompleted: false,
  };
}

/**
 * Format recurrence pattern into human-readable text
 */
export function formatRecurrenceText(pattern: any): string {
  if (!pattern) return '';

  const { frequency, interval, endDate, occurrences } = pattern;

  let text = 'Repeats ';

  // Frequency
  if (interval === 1) {
    switch (frequency) {
      case RecurrenceFrequency.DAILY:
        text += 'daily';
        break;
      case RecurrenceFrequency.WEEKLY:
        text += 'weekly';
        break;
      case RecurrenceFrequency.MONTHLY:
        text += 'monthly';
        break;
      case RecurrenceFrequency.YEARLY:
        text += 'yearly';
        break;
    }
  } else {
    switch (frequency) {
      case RecurrenceFrequency.DAILY:
        text += `every ${interval} days`;
        break;
      case RecurrenceFrequency.WEEKLY:
        text += `every ${interval} weeks`;
        break;
      case RecurrenceFrequency.MONTHLY:
        text += `every ${interval} months`;
        break;
      case RecurrenceFrequency.YEARLY:
        text += `every ${interval} years`;
        break;
    }
  }

  // End condition
  if (endDate) {
    text += ` until ${new Date(endDate).toLocaleDateString()}`;
  } else if (occurrences) {
    text += ` (${occurrences} remaining)`;
  }

  return text;
}
