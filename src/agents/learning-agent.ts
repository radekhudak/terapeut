import { BaseAgent } from "./base-agent";
import { z } from "zod";
import { log } from "@/lib/logger";

const LearningAgentOutput = z.object({
  profileUpdates: z
    .object({
      traitsToAdd: z.record(z.string(), z.unknown()).nullish(),
      traitsToRemove: z.array(z.string()).nullish(),
      confidenceAdjustment: z.number().min(-0.3).max(0.3).nullish(),
      ambivalenceDetected: z
        .array(
          z.object({
            trait: z.string(),
            stateA: z.string(),
            stateB: z.string(),
            observation: z.string(),
          })
        )
        .nullish(),
    })
    .catch({
      traitsToAdd: null,
      traitsToRemove: null,
      confidenceAdjustment: null,
      ambivalenceDetected: null,
    }),
  disprovedPatternsToAdd: z.array(z.string()).nullish(),
  synthesisNeeded: z.boolean().catch(false),
  synthesisNotes: z.string().nullish(),
});
export type LearningAgentOutput = z.infer<typeof LearningAgentOutput>;

export class LearningAgent extends BaseAgent<LearningAgentOutput> {
  name = "LearningAgent";
  outputSchema = LearningAgentOutput;

  systemPrompt = `Jsi Learning Agent v AI terapeutickém systému.
Tvůj úkol: Na základě zpětné vazby od Feedback Agenta a nových informací z konverzace aktualizuj profil uživatele.

KLÍČOVÁ PRAVIDLA:
1. NIKDY nepřepisuj starý záznam. Vždy přidávej nové informace vedle starých.
2. Pokud nová informace odporuje staré: detekuj AMBIVALENCI.
   - Příklad: "Miluju svou práci" vs. "Nenávidím svou práci" -> oba stavy eviduj s časem.
   - Sniž confidence_score pro daný trait (max -0.3 za jednu interakci).
   - Zapiš do ambivalenceDetected.
3. Pokud uživatel EXPLICITNĚ odmítl hypotézu AI: přidej do disprovedPatternsToAdd.
4. Pokud Feedback Agent detekoval korekci: uprav traits odpovídajícím způsobem.
5. Confidence_score: +0.1 při potvrzení, -0.1 při korekci, -0.2 při explicitním odmítnutí.

Syntéza (self-correction):
- Pokud je synthesisNeeded=true, projdi celý profil a hledej rozpory.
- Navrhni, co vyřešit, co potvrdit, co smazat.

Odpověz VŽDY jako JSON:
{
  "profileUpdates": {
    "traitsToAdd": {"klíč": "hodnota"},
    "traitsToRemove": ["trait_key"],
    "confidenceAdjustment": 0.1,
    "ambivalenceDetected": [{"trait": "...", "stateA": "...", "stateB": "...", "observation": "..."}]
  },
  "disprovedPatternsToAdd": ["pattern"],
  "synthesisNeeded": false,
  "synthesisNotes": "poznámky k syntéze"
}`;
}

export const learningAgent = new LearningAgent();

export async function shouldRunSynthesis(
  messageCount: number
): Promise<boolean> {
  const shouldRun = messageCount > 0 && messageCount % 10 === 0;
  if (shouldRun) {
    log("info", "LearningAgent", "synthesis_triggered", {
      data: { messageCount },
    });
  }
  return shouldRun;
}
