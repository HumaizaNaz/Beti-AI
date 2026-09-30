export interface ParsedTrip {
  vehicleNumber: string;
  rideType: string;
  destination: string;
  etaMinutes: number;
  confidence: number;
}

export class TripParserSkill {
  parseTripMessage(text: string): ParsedTrip | null {
    const cleanText = text.trim();
    const lowerText = cleanText.toLowerCase();

    // 1. Extract Vehicle Number Pattern (e.g., KHI-1234, LE-999, BK 4521, ABC-123, 1234)
    const vehicleRegex = /([a-zA-Z]{1,4}[-\s]?[0-9]{2,4})/i;
    const vehicleMatch = cleanText.match(vehicleRegex);
    const vehicleNumber = vehicleMatch ? vehicleMatch[1].toUpperCase().replace(/\s+/g, '-') : 'UNKNOWN-VEHICLE';

    // 2. Extract Ride Type
    let rideType = 'Private Ride';
    if (lowerText.includes('rickshaw') || lowerText.includes('rikshaw')) rideType = 'Auto Rickshaw';
    else if (lowerText.includes('uber')) rideType = 'Uber';
    else if (lowerText.includes('careem')) rideType = 'Careem';
    else if (lowerText.includes('indrive') || lowerText.includes('in-drive')) rideType = 'InDrive';
    else if (lowerText.includes('taxi') || lowerText.includes('cab')) rideType = 'Taxi';
    else if (lowerText.includes('bus') || lowerText.includes('van')) rideType = 'Bus / Van';
    else if (lowerText.includes('walk') || lowerText.includes('paidal')) rideType = 'Walking';

    // 3. Extract ETA / Duration in minutes
    let etaMinutes = 20; // Default safety window
    const minRegex = /(\d+)\s*(?:min|mins|minute|minutes|m)/i;
    const minMatch = lowerText.match(minRegex);
    if (minMatch) {
      etaMinutes = parseInt(minMatch[1], 10);
    } else if (lowerText.includes('adha ghanta') || lowerText.includes('half hour')) {
      etaMinutes = 30;
    } else if (lowerText.includes('ek ghanta') || lowerText.includes('1 hour') || lowerText.includes('one hour')) {
      etaMinutes = 60;
    }

    // 4. Extract Destination (e.g. to Home, to Office, IBA, Clifton, etc.)
    let destination = 'Destination';
    const destRegex = /(?:to|ja rahi|pohnchna|towards)\s+([a-zA-Z0-9\s]+?)(?:mein|,|\.|$|\d+\s*min)/i;
    const destMatch = cleanText.match(destRegex);
    if (destMatch && destMatch[1].trim().length > 1) {
      destination = destMatch[1].trim();
    } else {
      if (lowerText.includes('home') || lowerText.includes('ghar')) destination = 'Ghar (Home)';
      else if (lowerText.includes('office') || lowerText.includes('kaam')) destination = 'Office';
      else if (lowerText.includes('uni') || lowerText.includes('university') || lowerText.includes('college')) destination = 'University / College';
    }

    return {
      vehicleNumber,
      rideType,
      destination,
      etaMinutes: Math.max(1, etaMinutes),
      confidence: vehicleMatch ? 0.95 : 0.75
    };
  }
}

export const tripParserSkill = new TripParserSkill();
