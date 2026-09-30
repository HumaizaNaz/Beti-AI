import { DistressEvaluation, UserProfile } from '../core/types';

export interface AcousticFeaturePayload {
  decibel: number;
  pitchFrequencyHz: number;
  acousticRoughness: number; // 0 to 1
  transcript?: string;
}

export class VoiceDistressSkill {
  // Urgent distress words in Roman Urdu, Urdu and English
  private emergencyLexicon = [
    'help', 'help help', 'help me',
    'bachao', 'bchao', 'mujhe bachao',
    'chhoro', 'choro', 'mujhe chhoro', 'choro mujhe',
    'mat maaro', 'mat maro', 'chhor do',
    'mujhe jane do', 'jane do mujhe',
    'police', 'khatra', 'danger',
    'chor', 'daku', 'kidnap', 'ruk jao'
  ];

  /**
   * Evaluates text/transcription for specific distress keywords and phrases
   */
  evaluateText(text: string, user?: UserProfile): DistressEvaluation {
    const cleanText = text.trim().toLowerCase();

    // 1. Check for secret phrase if user profile exists
    if (user?.secretPhrase && cleanText.includes(user.secretPhrase.toLowerCase())) {
      return {
        isDistress: true,
        confidence: 0.99,
        triggerType: 'SECRET_PHRASE',
        details: `Secret safe-phrase matched: "${user.secretPhrase}"`,
        rawText: text
      };
    }

    // 2. Check for emergency spoken words (Help, Bachao, Chhoro, etc.)
    for (const phrase of this.emergencyLexicon) {
      if (cleanText.includes(phrase)) {
        return {
          isDistress: true,
          confidence: 0.95,
          triggerType: 'PANIC_KEYWORD',
          details: `Emergency distress word detected: "${phrase}"`,
          rawText: text
        };
      }
    }

    return {
      isDistress: false,
      confidence: 0.0,
      details: 'Normal speech',
      rawText: text
    };
  }

  /**
   * Evaluates raw acoustic parameters (Scream & Struggle detection)
   * Human screams typically have:
   * - High Decibel (> 75 dB)
   * - High Pitch Frequency (> 1000 Hz to 3000 Hz)
   * - High Acoustic Roughness/Variance (> 0.7)
   */
  evaluateAcousticScream(features: AcousticFeaturePayload): DistressEvaluation {
    const isLoud = features.decibel > 75;
    const isHighPitch = features.pitchFrequencyHz > 1000 && features.pitchFrequencyHz < 3500;
    const isViolent = features.acousticRoughness > 0.65;

    if (isLoud && isHighPitch && isViolent) {
      return {
        isDistress: true,
        confidence: 0.96,
        triggerType: 'SCREAM_AUDIO',
        details: `Acoustic Panic Scream Pattern Confirmed (${features.decibel}dB, ${Math.round(features.pitchFrequencyHz)}Hz pitch)`,
        rawText: '[SCREAM_AUDIO_DETECTED]'
      };
    }

    return {
      isDistress: false,
      confidence: 0.1,
      details: 'Ambient sound or normal volume',
      rawText: ''
    };
  }

  /**
   * Combined Multi-Modal Evaluator (Text + Audio Features)
   */
  evaluate(text: string, features?: AcousticFeaturePayload, user?: UserProfile): DistressEvaluation {
    // Check speech/words first
    const textEval = this.evaluateText(text, user);
    if (textEval.isDistress) return textEval;

    // Check acoustic frequency if available
    if (features) {
      const acousticEval = this.evaluateAcousticScream(features);
      if (acousticEval.isDistress) return acousticEval;
    }

    return {
      isDistress: false,
      confidence: 0.0,
      details: 'Clear / No distress detected',
      rawText: text
    };
  }
}

export const voiceDistressSkill = new VoiceDistressSkill();
