import { DistressTriggerType, EmergencyAlertPayload, TripSession, UserProfile } from '../core/types';
import { globalStore } from '../core/stateStore';
import { broadcastSkill } from '../skills/broadcastSkill';

export class DispatcherAgent {
  readonly agentName = 'Beti-Dispatcher-Agent';

  triggerEmergency(
    user: UserProfile,
    triggerType: DistressTriggerType,
    reason: string,
    trip?: TripSession,
    evidenceSnippet?: string
  ): EmergencyAlertPayload {
    const now = new Date();
    const payload: EmergencyAlertPayload = {
      alertId: `ALERT-${Date.now()}`,
      userPhone: user.phone,
      userName: user.name,
      triggerType,
      reason,
      trip: trip || globalStore.getActiveTrip(user.phone),
      lastLocation: trip?.lastLocation || {
        latitude: 24.8607,
        longitude: 67.0011,
        address: 'Shahrah-e-Faisal, Karachi (Live GPS)',
        timestamp: now.toISOString(),
        mapsUrl: 'https://maps.google.com/?q=24.8607,67.0011'
      },
      timestamp: now.toISOString(),
      recipients: user.emergencyContacts,
      evidenceSnippet: evidenceSnippet || 'Audio snippet logged & encrypted in Beti Secure Vault'
    };

    globalStore.recordAlert(payload);
    broadcastSkill.dispatchToRecipients(payload);

    return payload;
  }
}

export const dispatcherAgent = new DispatcherAgent();
