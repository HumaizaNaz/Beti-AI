import { EmergencyAlertPayload } from '../core/types';

export class BroadcastSkill {
  formatWhatsAppEmergencyMessage(payload: EmergencyAlertPayload): string {
    const timeStr = new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(payload.timestamp).toLocaleDateString();

    let vehicleSection = '';
    if (payload.trip) {
      vehicleSection = `\n🚗 *Ride Details:* ${payload.trip.vehicleNumber} (${payload.trip.destination})`;
    }

    return `🚨 *EMERGENCY ALERT - BETI AI GUARDIAN* 🚨\n\n` +
      `⚠️ *Attention:* Aapki beti *${payload.userName}* (${payload.userPhone}) ke sath contact toot gaya hai ya emergency trigger hui hai.\n\n` +
      `📌 *Reason:* ${payload.reason}${vehicleSection}\n` +
      `🕒 *Time:* ${timeStr} (${dateStr})\n` +
      `📍 *Last Known GPS Location:* ${payload.lastLocation.mapsUrl}\n` +
      (payload.evidenceSnippet ? `🎙️ *Audio Evidence Log:* ${payload.evidenceSnippet}\n\n` : '\n') +
      `📞 *Action Required:* Please unse foran contact karein ya nazdeeki police / rescue 15 ko inform karein.`;
  }

  formatSMSFallbackMessage(payload: EmergencyAlertPayload): string {
    return `[EMERGENCY] Beti AI: ${payload.userName} (${payload.userPhone}) needs help! Location: ${payload.lastLocation.mapsUrl}. Vehicle: ${payload.trip?.vehicleNumber || 'N/A'}. Reason: ${payload.reason}`;
  }

  dispatchToRecipients(payload: EmergencyAlertPayload): { whatsappCount: number; smsCount: number } {
    const waText = this.formatWhatsAppEmergencyMessage(payload);
    const smsText = this.formatSMSFallbackMessage(payload);

    console.log('\n======================================================');
    console.log('🚨 [DISPATCHER BROADCAST BUS ACTIVE]');
    console.log('======================================================');
    console.log(`📡 Sending Emergency Broadcast to ${payload.recipients.length} Family Contacts:`);

    payload.recipients.forEach((contact, idx) => {
      console.log(`\n  👉 [Recipient ${idx + 1}] ${contact.name} (${contact.relationship}) - ${contact.phone}`);
      console.log('  💬 [WhatsApp Payload Encrypted Preview]:');
      console.log('  --------------------------------------------------');
      console.log(waText.split('\n').map(l => `     ${l}`).join('\n'));
      console.log('  --------------------------------------------------');
      console.log(`  📱 [Cellular SMS Fallback]: "${smsText}"`);
    });

    console.log('======================================================\n');

    return {
      whatsappCount: payload.recipients.length,
      smsCount: payload.recipients.length
    };
  }
}

export const broadcastSkill = new BroadcastSkill();
