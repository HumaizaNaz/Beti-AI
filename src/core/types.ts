export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface UserProfile {
  phone: string;
  name: string;
  emergencyContacts: EmergencyContact[];
  secretPhrase?: string;      // e.g. "bhaiya late ho gaya"
  safePin: string;             // e.g. "1234" to disarm safely
  duressPin?: string;          // e.g. "9999" (Hostage fake-disarm PIN)
  createdAt: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: string;
  mapsUrl: string;
}

export type TripStatus = 'IN_PROGRESS' | 'CHECKING_IN' | 'SAFE_COMPLETED' | 'EMERGENCY_TRIGGERED' | 'TIMED_OUT';

export interface TripSession {
  tripId: string;
  userPhone: string;
  vehicleNumber: string;
  origin?: string;
  destination: string;
  etaMinutes: number;
  startTime: string;
  expectedEndTime: string;
  status: TripStatus;
  lastLocation?: GeoLocation;
  checkInSent?: boolean;
}

export type DistressTriggerType = 
  | 'SECRET_PHRASE'
  | 'PANIC_KEYWORD'
  | 'SCREAM_AUDIO'
  | 'DURESS_PIN'
  | 'DEAD_MAN_TIMEOUT'
  | 'ROUTE_DEVIATION';

export interface DistressEvaluation {
  isDistress: boolean;
  confidence: number;
  triggerType?: DistressTriggerType;
  details: string;
  rawText?: string;
}

export interface EmergencyAlertPayload {
  alertId: string;
  userPhone: string;
  userName: string;
  triggerType: DistressTriggerType;
  reason: string;
  trip?: TripSession;
  lastLocation: GeoLocation;
  timestamp: string;
  recipients: EmergencyContact[];
  evidenceSnippet?: string;
}
