import { EmergencyContact, UserProfile } from '../core/types';
import { globalStore } from '../core/stateStore';

export class ContactManagerSkill {
  registerOrUpdateUser(phone: string, name: string, safePin: string = '1234', secretPhrase: string = 'bhaiya late ho raha hai'): UserProfile {
    const existing = globalStore.getUser(phone);
    const user: UserProfile = existing || {
      phone,
      name,
      emergencyContacts: [],
      secretPhrase,
      safePin,
      duressPin: '9999',
      createdAt: new Date().toISOString()
    };
    user.name = name;
    user.safePin = safePin;
    user.secretPhrase = secretPhrase;
    globalStore.saveUser(user);
    return user;
  }

  addEmergencyContact(userPhone: string, contact: Omit<EmergencyContact, 'id'>): EmergencyContact {
    const user = globalStore.getUser(userPhone);
    if (!user) {
      throw new Error(`User with phone ${userPhone} not found`);
    }

    const newContact: EmergencyContact = {
      ...contact,
      id: (user.emergencyContacts.length + 1).toString()
    };

    user.emergencyContacts.push(newContact);
    globalStore.saveUser(user);
    return newContact;
  }

  getContacts(userPhone: string): EmergencyContact[] {
    const user = globalStore.getUser(userPhone);
    return user ? user.emergencyContacts : [];
  }
}

export const contactManagerSkill = new ContactManagerSkill();
