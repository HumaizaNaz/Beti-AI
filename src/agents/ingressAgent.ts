import { UserProfile } from '../core/types';
import { globalStore } from '../core/stateStore';
import { contactManagerSkill } from '../skills/contactManagerSkill';

export class IngressAgent {
  readonly agentName = 'Beti-Ingress-Agent';

  handleIncomingMessage(senderPhone: string, text: string): { reply: string; user: UserProfile } {
    let user = globalStore.getUser(senderPhone);
    const cleanText = text.trim();

    // New user onboarding
    if (!user) {
      user = contactManagerSkill.registerOrUpdateUser(senderPhone, 'User');
      return {
        user,
        reply: `Assalam-o-Alaikum! 🛡️ Main hoon *Beti AI Guardian*.\n\n` +
          `Aapki hifazat ke liye main 24/7 tayyar hoon.\n` +
          `Pehle apne 2 Emergency Family Contacts save kar lein:\n` +
          `Example reply: *ADD CONTACT Ammi +923001112233 Mother*`
      };
    }

    // Help command
    if (cleanText.toLowerCase() === 'help' || cleanText.toLowerCase() === 'menu') {
      return {
        user,
        reply: `🛡️ *Beti AI Menu:*\n\n` +
          `1. 🚗 *Start Trip:* "Rickshaw KHI-1234, 20 mins to Home"\n` +
          `2. ✅ *Safe Arrival:* "Safe" ya PIN enter karein\n` +
          `3. 👥 *My Contacts:* Type "CONTACTS"\n` +
          `4. 🚨 *Instant SOS:* Secret phrase bolen ya "SOS" likhein\n` +
          `5. 🔑 *Secret Phrase:* "${user.secretPhrase || 'bhaiya late ho raha hai'}"`
      };
    }

    // Show contacts
    if (cleanText.toLowerCase() === 'contacts') {
      const list = user.emergencyContacts
        .map((c, i) => `${i + 1}. ${c.name} (${c.relationship}): ${c.phone}`)
        .join('\n');
      return {
        user,
        reply: `👥 *Aapke Saved Emergency Contacts:*\n${list || 'Koi contact nahi mila.'}\n\nNaya contact add karne ke liye likhein:\n*ADD CONTACT Name Phone Relationship*`
      };
    }

    return { user, reply: '' };
  }
}

export const ingressAgent = new IngressAgent();
