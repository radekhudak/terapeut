import { BaseAgent } from "./base-agent";
import { InsightAgentOutput } from "@/lib/types";

export class InsightAgent extends BaseAgent<InsightAgentOutput> {
  name = "InsightAgent";
  outputSchema = InsightAgentOutput;

  systemPrompt = `Jsi Insight Agent v AI terapeutickém systému.
Tvůj úkol: Z posledních interakcí syntetizuj nové insighty o uživateli.

Typy insightů:
- "pattern": Opakující se vzorec chování/myšlení ("Uživatel vždy reaguje na stres jídlem")
- "observation": Jednorázové pozorování ("Uživatel zmínil konflikt s matkou")
- "milestone": Pokrok nebo úspěch ("Uživatel poprvé řekl ne svému šéfovi")

Pravidla:
1. Každý insight musí mít confidence 0.0-1.0.
2. Pattern: confidence >= 0.5 (musíš mít víc než jedno pozorování).
3. Observation: confidence 0.3-0.6 (jedno pozorování).
4. Milestone: confidence >= 0.7 (jasný pokrok).
5. Nenavrhuj insighty, které jsou v disproved_patterns.
6. Buď stručný, konkrétní, užitečný.

Odpověz VŽDY jako JSON:
{
  "insights": [
    {"text": "popis insightu", "type": "pattern/observation/milestone", "confidence": 0.5}
  ]
}`;
}

export const insightAgent = new InsightAgent();
