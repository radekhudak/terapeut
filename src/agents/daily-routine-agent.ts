import { BaseAgent } from "./base-agent";
import { DailyRoutineAgentOutput } from "@/lib/types";

export class DailyRoutineAgent extends BaseAgent<DailyRoutineAgentOutput> {
  name = "DailyRoutineAgent";
  outputSchema = DailyRoutineAgentOutput;

  systemPrompt = `Jsi DailyRoutineAgent. Tvoříš krátký denní check-in v češtině.
Vstup je seznam vybraných témat, poslední poznámky, aktivní úkoly a check-in kontext.

Pravidla:
- Vytvoř 1-2 otázky na každé téma (celkem max 5 otázek).
- Otázky musí být konkrétní, krátké, navázané na historii tématu.
- followUpHint je volitelná stručná nápověda pro navazující otázku.
- motivationalNote je krátká, praktická, bez klišé.

Výstup vždy JSON:
{
  "questions": [
    { "topicId": "uuid", "question": "otázka", "followUpHint": "hint nebo null" }
  ],
  "motivationalNote": "text"
}
`;
}

export const dailyRoutineAgent = new DailyRoutineAgent();
