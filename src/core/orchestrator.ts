import { globalStore } from './stateStore';
import { ingressAgent } from '../agents/ingressAgent';
import { tripAgent } from '../agents/tripAgent';
import { watchdogAgent } from '../agents/watchdogAgent';
import { distressAgent } from '../agents/distressAgent';
import { dispatcherAgent } from '../agents/dispatcherAgent';

export interface MessageProcessResult {
  reply: string;
  isEmergencyTriggered: boolean;
  alertId?: string;
}

export class BetiOrchestrator {
  constructor() {
    // Setup Watchdog callbacks for Dead-Man's switch
    watchdogAgent.setHandlers(
      (trip, reason) => {
        const user = globalStore.getUser(trip.userPhone);
        if (user) {
          dispatcherAgent.triggerEmergency(user, 'DEAD_MAN_TIMEOUT', reason, trip);
        }
      },
      (trip) => {
        console.log(`\n[Beti Guardian Watchdog Check-in to ${trip.userPhone}]:`);
        console.log(`💬 "Aap pohnchne wali hain (${trip.destination}). Sab theek hai? Please 'Safe' reply karein."\n`);
      }
    );
  }

  processUserMessage(senderPhone: string, text: string): MessageProcessResult {
    // 1. Ingress Agent initial check
    const { user, reply } = ingressAgent.handleIncomingMessage(senderPhone, text);
    if (reply) {
      return { reply, isEmergencyTriggered: false };
    }

    // 2. Distress Agent analysis (Checks for secret phrases, panic keywords, duress PINs)
    const distress = distressAgent.analyze(text, user);
    if (distress.isDistress) {
      const activeTrip = globalStore.getActiveTrip(user.phone);
      const alert = dispatcherAgent.triggerEmergency(
        user,
        distress.triggerType || 'SECRET_PHRASE',
        distress.details,
        activeTrip,
        distress.rawText
      );

      // If duress PIN was entered, fake normal reply to deceive attacker
      if (distress.triggerType === 'DURESS_PIN') {
        return {
          reply: 'PIN Accepted. System stand-by.',
          isEmergencyTriggered: true,
          alertId: alert.alertId
        };
      }

      // If secret phrase was used, send subtle reply or silence
      if (distress.triggerType === 'SECRET_PHRASE') {
        return {
          reply: 'Ji theek hai, khayal rakhein.',
          isEmergencyTriggered: true,
          alertId: alert.alertId
        };
      }

      return {
        reply: `🚨 *EMERGENCY PROTOCOL ACTIVATED!* Family contacts ko live location & alert bhej diya gaya hai.`,
        isEmergencyTriggered: true,
        alertId: alert.alertId
      };
    }

    // 3. Safe Arrival Check
    if (tripAgent.isSafeArrivalMessage(text, user)) {
      watchdogAgent.disarm(user.phone);
      const safeReply = tripAgent.completeTripSafely(user);
      return { reply: safeReply, isEmergencyTriggered: false };
    }

    // 4. Trip Initiation Check
    if (tripAgent.isTripInitiationMessage(text)) {
      const { trip, confirmationMessage } = tripAgent.startTrip(user, text);
      watchdogAgent.armDeadManSwitch(trip);
      return { reply: confirmationMessage, isEmergencyTriggered: false };
    }

    // Default conversational response
    return {
      reply: `Main Beti AI hoon. Agar aap safar kar rahi hain toh gaadi ka number aur time bhej dein (e.g. *"Rickshaw KHI-1234, 20 mins to Home"*). Ya help ke liye *"MENU"* likhein.`,
      isEmergencyTriggered: false
    };
  }
}

export const betiOrchestrator = new BetiOrchestrator();
