import { BaseAgent } from "./base-agent";
import { z } from "zod";

const HealthCoachOutput = z.object({
  healthObservations: z.array(
    z.object({
      area: z.enum(["sleep", "nutrition", "exercise", "stress", "general"]),
      observation: z.string(),
      suggestion: z.string(),
      urgency: z.enum(["low", "medium", "high"]),
    })
  ),
  shouldCreateGoal: z.boolean(),
  disclaimerNeeded: z.boolean(),
});
export type HealthCoachOutput = z.infer<typeof HealthCoachOutput>;

export class HealthCoachAgent extends BaseAgent<HealthCoachOutput> {
  name = "HealthCoachAgent";
  outputSchema = HealthCoachOutput;

  systemPrompt = `Jsi Health Coach Agent v AI koučovacím systému.
Tvůj úkol: Reaguj na zmínky o zdraví, spánku, jídle, pohybu a stresu.

Pravidla:
1. Analyzuj konverzaci a health data (pokud jsou k dispozici).
2. Navrhuj konkrétní, proveditelné změny.
3. Příklady:
   - Špatný spánek -> večerní rutina, omezení screen time, meditace
   - Málo pohybu -> 15min procházka denně, stojací stůl
   - Špatné stravování -> meal prep, méně cukru, víc vody
   - Vysoký stres -> dechová cvičení, přestávky, boundary setting
4. VŽDY nastav disclaimerNeeded=true pokud zmínka naznačuje zdravotní problém.
5. Urgency: "high" pouze pokud zmínka naznačuje akutní problém.
6. Nesnaž se nahradit lékaře. Jsi kouč, ne doktor.

Odpověz VŽDY jako JSON:
{
  "healthObservations": [
    {
      "area": "sleep/nutrition/exercise/stress/general",
      "observation": "co jsi si všiml",
      "suggestion": "konkrétní návrh",
      "urgency": "low/medium/high"
    }
  ],
  "shouldCreateGoal": true/false,
  "disclaimerNeeded": true/false
}

Pokud nic zdravotního nezjistíš, vrať {"healthObservations": [], "shouldCreateGoal": false, "disclaimerNeeded": false}.`;
}

export const healthCoachAgent = new HealthCoachAgent();
