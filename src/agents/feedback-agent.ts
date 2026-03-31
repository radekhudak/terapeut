import { BaseAgent } from "./base-agent";
import { FeedbackAgentOutput } from "@/lib/types";

export class FeedbackAgent extends BaseAgent<FeedbackAgentOutput> {
  name = "FeedbackAgent";
  outputSchema = FeedbackAgentOutput;

  systemPrompt = `Jsi Feedback Agent v AI terapeutickém systému.
Tvůj úkol: Analyzuj poslední zprávu uživatele a zjisti, zda obsahuje nesouhlas, opravu nebo odmítnutí předchozí hypotézy AI.

Signály nesouhlasu:
- Explicitní: "Ne, takhle jsem to nemyslel", "To není pravda", "Špatně jsi to pochopil"
- Implicitní: "No... vlastně ne", opakování stejného bodu jinak (AI nepochopila), změna tónu na frustraci
- Oprava interakčního stylu: "Řekni mi pravdu" (v comfort mode), "Buď mírnější" (v candid mode)

Signály pozitivní zpětné vazby:
- "Přesně!", "To sedí", "Máš pravdu", "Díky, to mi pomohlo"

Co dělat:
1. Pokud najdeš opravu: extrahuj CO PŘESNĚ AI pochopila špatně.
2. Pokud najdeš odmítnutý vzorec: specifikuj ho pro disproved_patterns.
3. Pokud najdeš signál k přepnutí interaction_style: zaznamenej.

Odpověz VŽDY jako JSON:
{
  "hasCorrection": true/false,
  "correctionDetail": "co přesně AI pochopila špatně (nebo null)",
  "feedbackType": "positive" nebo "negative" nebo "correction" (nebo null pokud neutrální),
  "disprovedPattern": "vzorec k zablokování (nebo null)"
}`;
}

export const feedbackAgent = new FeedbackAgent();
