import { UserProfile, TripSession, EmergencyAlertPayload } from './types';

export class StateStore {
  private users: Map<string, UserProfile> = new Map();
  private activeTrips: Map<string, TripSession> = new Map();
  private alertsLog: EmergencyAlertPayload[] = [];

  constructor() {
    this.seedDefaultDemoUser();
  }

  private seedDefaultDemoUser() {
    const demoPhone = '+923001234567';
    this.users.set(demoPhone, {
      phone: demoPhone,
      name: 'Ayesha',
      emergencyContacts: [
        { id: '1', name: 'Ammi', phone: '+923007654321', relationship: 'Mother' },
        { id: '2', name: 'Ali (Bhai)', phone: '+923009876543', relationship: 'Brother' }
      ],
      secretPhrase: 'bhaiya late ho raha hai',
      safePin: '1234',
      duressPin: '9999',
      createdAt: new Date().toISOString()
    });
  }

  // User methods
  getUser(phone: string): UserProfile | undefined {
    return this.users.get(phone);
  }

  saveUser(user: UserProfile): void {
    this.users.set(user.phone, user);
  }

  // Trip methods
  getActiveTrip(phone: string): TripSession | undefined {
    return this.activeTrips.get(phone);
  }

  saveTrip(trip: TripSession): void {
    this.activeTrips.set(trip.userPhone, trip);
  }

  clearTrip(phone: string): void {
    this.activeTrips.delete(phone);
  }

  // Alerts
  recordAlert(alert: EmergencyAlertPayload): void {
    this.alertsLog.push(alert);
  }

  getAlerts(): EmergencyAlertPayload[] {
    return this.alertsLog;
  }
}

export const globalStore = new StateStore();
