import { TripSession, UserProfile } from '../core/types';
import { globalStore } from '../core/stateStore';
import { tripParserSkill } from '../skills/tripParserSkill';

export class TripAgent {
  readonly agentName = 'Beti-Trip-Agent';

  isTripInitiationMessage(text: string): boolean {
    const lower = text.toLowerCase();
    const tripKeywords = [
      'rickshaw', 'rikshaw', 'uber', 'careem', 'indrive', 'taxi',
      'bus', 'van', 'walk', 'nikal gayi', 'baith gayi', 'going to',
      'rasta', 'pohnch', 'mins', 'minute', 'khi-', 'le-', 'bk-'
    ];
    return tripKeywords.some(k => lower.includes(k));
  }

  isSafeArrivalMessage(text: string, user: UserProfile): boolean {
    const lower = text.trim().toLowerCase();
    return (
      lower === 'safe' ||
      lower === 'home' ||
      lower === 'pohnch gayi' ||
      lower === 'reached' ||
      lower === 'clear' ||
      lower === user.safePin.toLowerCase()
    );
  }

  startTrip(user: UserProfile, text: string): { trip: TripSession; confirmationMessage: string } {
    const parsed = tripParserSkill.parseTripMessage(text);
    const now = new Date();
    const etaMinutes = parsed ? parsed.etaMinutes : 20;
    const expectedEnd = new Date(now.getTime() + etaMinutes * 60000);

    const trip: TripSession = {
      tripId: `TRIP-${Date.now()}`,
      userPhone: user.phone,
      vehicleNumber: parsed ? parsed.vehicleNumber : 'UNIDENTIFIED',
      destination: parsed ? parsed.destination : 'Destination',
      etaMinutes,
      startTime: now.toISOString(),
      expectedEndTime: expectedEnd.toISOString(),
      status: 'IN_PROGRESS',
      lastLocation: {
        latitude: 24.8607,
        longitude: 67.0011,
        address: 'Saddar, Karachi (Simulated Live GPS)',
        timestamp: now.toISOString(),
        mapsUrl: 'https://maps.google.com/?q=24.8607,67.0011'
      }
    };

    globalStore.saveTrip(trip);

    const confirmationMessage =
      `🛡️ *Trip Logged & Safety Timer Started!*\n\n` +
      `🚗 *Vehicle:* ${trip.vehicleNumber} (${parsed?.rideType || 'Ride'})\n` +
      `📍 *Destination:* ${trip.destination}\n` +
      `⏱️ *Dead-Man's Timer:* ${trip.etaMinutes} minutes\n` +
      `🛡️ *Guardian Status:* Server monitoring is ACTIVE.\n\n` +
      `Aap jab pohnch jayein toh *"Safe"* likh dein ya PIN enter karein.\n` +
      `Agar phone dead bhi ho gaya, timer khatam hone par main family ko alert kar dungi.`;

    return { trip, confirmationMessage };
  }

  completeTripSafely(user: UserProfile): string {
    const trip = globalStore.getActiveTrip(user.phone);
    if (!trip) {
      return `Aap ka koi active trip chal nahi raha tha. Sab theek hai! 👍`;
    }

    trip.status = 'SAFE_COMPLETED';
    globalStore.clearTrip(user.phone);

    return `✅ *Alhamdulillah! Safe Arrival Confirmed.*\n\n` +
      `Dead-Man's timer band kar diya gaya hai. Aap bilkul safe hain. 🌸`;
  }
}

export const tripAgent = new TripAgent();
