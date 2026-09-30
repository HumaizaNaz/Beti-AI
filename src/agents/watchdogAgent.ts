import { TripSession } from '../core/types';
import { timerEngineSkill } from '../skills/timerEngineSkill';
import { globalStore } from '../core/stateStore';

export type WatchdogAlertHandler = (trip: TripSession, reason: string) => void;
export type WatchdogCheckInHandler = (trip: TripSession) => void;

export class WatchdogAgent {
  readonly agentName = 'Beti-Watchdog-Agent';
  private alertHandler?: WatchdogAlertHandler;
  private checkInHandler?: WatchdogCheckInHandler;

  setHandlers(alertHandler: WatchdogAlertHandler, checkInHandler: WatchdogCheckInHandler): void {
    this.alertHandler = alertHandler;
    this.checkInHandler = checkInHandler;
  }

  armDeadManSwitch(trip: TripSession): void {
    console.log(`[WatchdogAgent] ⏱️ Armed Dead-Man's Switch for ${trip.userPhone} (${trip.etaMinutes} mins)`);

    timerEngineSkill.startTripTimer(trip, (activeTrip, eventType) => {
      const currentTrip = globalStore.getActiveTrip(activeTrip.userPhone);
      if (!currentTrip || currentTrip.status === 'SAFE_COMPLETED') {
        return; // Already safely completed
      }

      if (eventType === 'CHECK_IN') {
        console.log(`[WatchdogAgent] 🔔 Check-in prompt triggered for ${activeTrip.userPhone}`);
        currentTrip.checkInSent = true;
        globalStore.saveTrip(currentTrip);
        if (this.checkInHandler) this.checkInHandler(currentTrip);
      } else if (eventType === 'TIMEOUT_EMERGENCY') {
        console.log(`[WatchdogAgent] 🚨 DEAD-MAN TIMEOUT EXPIRED for ${activeTrip.userPhone}! Triggering Emergency!`);
        currentTrip.status = 'TIMED_OUT';
        globalStore.saveTrip(currentTrip);
        if (this.alertHandler) {
          this.alertHandler(
            currentTrip,
            `Dead-Man's Timer expired (${currentTrip.etaMinutes} mins elapsed). User phone appears unreachable/dead without safe check-in.`
          );
        }
      }
    });
  }

  disarm(userPhone: string): void {
    console.log(`[WatchdogAgent] 🛡️ Disarming Dead-Man's Switch for ${userPhone}`);
    timerEngineSkill.cancelTripTimer(userPhone);
  }
}

export const watchdogAgent = new WatchdogAgent();
