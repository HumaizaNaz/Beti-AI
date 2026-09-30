import { TripSession } from '../core/types';

export type TimerCallback = (trip: TripSession, eventType: 'CHECK_IN' | 'TIMEOUT_EMERGENCY') => void;

interface ActiveTimerHandle {
  checkInTimer?: NodeJS.Timeout;
  emergencyTimer: NodeJS.Timeout;
  trip: TripSession;
}

export class TimerEngineSkill {
  private activeTimers: Map<string, ActiveTimerHandle> = new Map();

  startTripTimer(trip: TripSession, callback: TimerCallback): void {
    this.cancelTripTimer(trip.userPhone);

    const totalSeconds = trip.etaMinutes * 60;
    const checkInSeconds = Math.max(5, Math.floor(totalSeconds * 0.8)); // 80% mark

    // In simulated/fast test environments, scale times if needed
    const checkInMs = checkInSeconds * 1000;
    const emergencyMs = totalSeconds * 1000;

    const checkInTimer = setTimeout(() => {
      callback(trip, 'CHECK_IN');
    }, checkInMs);

    const emergencyTimer = setTimeout(() => {
      callback(trip, 'TIMEOUT_EMERGENCY');
    }, emergencyMs);

    this.activeTimers.set(trip.userPhone, {
      checkInTimer,
      emergencyTimer,
      trip
    });
  }

  cancelTripTimer(userPhone: string): void {
    const handle = this.activeTimers.get(userPhone);
    if (handle) {
      if (handle.checkInTimer) clearTimeout(handle.checkInTimer);
      if (handle.emergencyTimer) clearTimeout(handle.emergencyTimer);
      this.activeTimers.delete(userPhone);
    }
  }

  hasActiveTimer(userPhone: string): boolean {
    return this.activeTimers.has(userPhone);
  }
}

export const timerEngineSkill = new TimerEngineSkill();
