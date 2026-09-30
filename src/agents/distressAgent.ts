import { DistressEvaluation, UserProfile } from '../core/types';
import { voiceDistressSkill } from '../skills/voiceDistressSkill';

export class DistressAgent {
  readonly agentName = 'Beti-Distress-Agent';

  analyze(text: string, user: UserProfile): DistressEvaluation {
    const result = voiceDistressSkill.evaluate(text, undefined, user);
    if (result.isDistress) {
      console.log(`[DistressAgent] ⚠️ DISTRESS DETECTED! Trigger: ${result.triggerType} (Confidence: ${result.confidence})`);
    }
    return result;
  }
}

export const distressAgent = new DistressAgent();
