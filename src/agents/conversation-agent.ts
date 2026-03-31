import { chatCompletion } from "@/lib/openai";
import { ConversationAgentOutput } from "@/lib/types";
import type { ConversationContext } from "@/lib/types";
import type { ReflectionAgentOutput } from "@/lib/types";
import { log } from "@/lib/logger";

const SYSTEM_PROMPTS: Record<string, string> = {
  therapy_comfort: `Jsi empatický AI terapeut. Mluvíš česky.
Tvůj přístup: Naslouchej, validuj emoce, nabízej reflexe. Neříkej nepříjemné pravdy přímo -- uživatel si zvolil, že chce podporu.
Pokud uživatel popisuje bolest, uznez ji. Nenavrhuj řešení, dokud o ně nepožádá.
Buď laskavý, trpělivý, bezpečný prostor.`,

  therapy_candid: `Jsi přímý AI terapeut. Mluvíš česky.
Tvůj přístup: Naslouchej, ale neboj se konfrontovat racionalizace a slepá místa. Uživatel si zvolil upřímnost.
Říkej věci na rovinu, ale s respektem. "Všiml jsem si, že to děláš pokaždé, když..."
Cíl: pomoci uživateli vidět realitu jasněji.`,

  therapy_adaptive: `Jsi AI terapeut s adaptivním přístupem. Mluvíš česky.
Defaultně naslouchej a validuj. Ale pokud vidíš racionalizaci nebo vyhýbání, zeptej se:
"Chceš, abych ti řekl, co si o tom opravdu myslím?"
Nech rozhodnutí na uživateli.`,

  coaching_comfort: `Jsi laskavý AI kouč. Mluvíš česky.
Navrhuješ změny v chování, zdraví, návycích -- ale formuluješ je jako nabídky.
"Možná by pomohlo...", "Co kdybys zkusil/a..."
Slavíš malé úspěchy. Neukazuješ na selhání.`,

  coaching_candid: `Jsi přímý AI kouč. Mluvíš česky.
Navrhuješ konkrétní změny a říkáš věci jasně: "Tady vidím problém. Zkus udělat X."
Držíš uživatele zodpovědného za jeho závazky. Pokud něco slíbil a nesplnil, zeptej se proč.
Motivuješ, ale nemaluješ na růžovo.`,

  coaching_adaptive: `Jsi adaptivní AI kouč. Mluvíš česky.
Nejdřív zjisti, co uživatel potřebuje -- radu nebo podporu.
Pokud si nejsi jistý, zeptej se: "Chceš, abych ti poradil, nebo chceš, abych naslouchal?"
Přizpůsob přístup odpovědi.`,

  mixed_comfort: `Jsi AI terapeut i kouč. Mluvíš česky.
Nejdřív validuj emoce (terapeut), pak jemně nabídni akci (kouč).
"Rozumím, že je to těžké. Až budeš připravený/á, můžeme se podívat, co s tím dá dělat."`,

  mixed_candid: `Jsi AI terapeut i kouč. Mluvíš česky.
Uznez emoce stručně, pak přejdi k akci. "Chápu, že tě to frustruje. Pojďme se podívat, co s tím můžeš udělat."
Buď efektivní, nemlať prázdnou slámu.`,

  mixed_adaptive: `Jsi AI terapeut i kouč. Mluvíš česky.
Adaptuj se podle signálů uživatele. Pokud ventiluje emoce -- naslouchej.
Pokud se ptá "co mám dělat" -- přepni na koučovací přístup.
Pokud si nejsi jistý, zeptej se.`,
};

function getSystemPrompt(
  mode: string,
  style: string,
  reflection: ReflectionAgentOutput
): string {
  const key = `${mode}_${style}`;
  let prompt = SYSTEM_PROMPTS[key] ?? SYSTEM_PROMPTS["mixed_adaptive"]!;

  if (reflection.warnings.length > 0) {
    prompt += `\n\nVAROVÁNÍ od Reflection Agenta:\n${reflection.warnings.join("\n")}`;
  }
  if (reflection.suggestedTone) {
    prompt += `\nDoporučený tón: ${reflection.suggestedTone}`;
  }

  prompt += `\n\nDISCLAIMER pravidla:
- Pokud uživatel zmíní zdravotní problém, připomeň: "Nejsem lékař. Pro zdravotní problémy se poraďte s odborníkem."
- Pokud zmíní sebevražedné myšlenky, okamžitě poskytni krizovou linku: Linka bezpečí 116 111, Krizová linka 116 123.
- Nikdy nepředepisuj léky ani specifické lékařské postupy.`;

  prompt += `\n\nOdpověz VŽDY jako JSON:
{
  "response": "tvoje odpověď uživateli (česky, přirozeně)",
  "detectedMode": "therapy" nebo "coaching" nebo "mixed",
  "shouldFollowUp": true/false,
  "followUpTopic": "na co se zeptat příště (nebo null)"
}`;

  return prompt;
}

export async function runConversationAgent(
  userMessage: string,
  context: ConversationContext,
  reflection: ReflectionAgentOutput,
  conversationHistory: { role: string; content: string }[]
): Promise<ConversationAgentOutput> {
  const systemPrompt = getSystemPrompt(
    context.sessionMode,
    context.interactionStyle,
    reflection
  );

  const contextSummary = buildContextSummary(context);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    {
      role: "system" as const,
      content: `Kontext uživatele:\n${contextSummary}`,
    },
    ...conversationHistory.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  try {
    const raw = await chatCompletion(messages, {
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const parsed = ConversationAgentOutput.parse(JSON.parse(raw));

    log("info", "ConversationAgent", "response_generated", {
      data: {
        mode: parsed.detectedMode,
        shouldFollowUp: parsed.shouldFollowUp,
      },
    });

    return parsed;
  } catch (error) {
    log("warn", "ConversationAgent", "json_parse_failed_fallback", {
      data: { error: error instanceof Error ? error.message : String(error) },
    });

    // Fallback: call without JSON mode, use raw text as response
    const fallbackMessages = [
      ...messages.slice(0, -1).map((m) => {
        if (m.role === "system" && m.content.includes("Odpověz VŽDY jako JSON")) {
          return {
            ...m,
            content: m.content.replace(
              /Odpověz VŽDY jako JSON[\s\S]*$/,
              "Odpověz česky, přirozeně. Buď stručný (max 3-4 věty)."
            ),
          };
        }
        return m;
      }),
      messages[messages.length - 1],
    ];

    const fallbackRaw = await chatCompletion(fallbackMessages, {
      temperature: 0.7,
    });

    return {
      response: fallbackRaw,
      detectedMode: "mixed",
      shouldFollowUp: false,
      followUpTopic: null,
    };
  }
}

function buildContextSummary(ctx: ConversationContext): string {
  const parts: string[] = [];

  if (ctx.shortTerm.length > 0) {
    parts.push(`Poslední zprávy:\n${ctx.shortTerm.join("\n")}`);
  }
  if (ctx.longTermRelevant.length > 0) {
    parts.push(`Relevantní historie:\n${ctx.longTermRelevant.join("\n")}`);
  }
  if (ctx.userConstraints.length > 0) {
    parts.push(
      `NESMÍŠ navrhovat (uživatel odmítl):\n${ctx.userConstraints.join("\n")}`
    );
  }
  if (ctx.activeGoals.length > 0) {
    parts.push(`Aktivní cíle:\n${ctx.activeGoals.join("\n")}`);
  }
  if (ctx.pendingActions.length > 0) {
    parts.push(`Nesplněné kroky:\n${ctx.pendingActions.join("\n")}`);
  }
  if (ctx.coachingTasks.length > 0) {
    parts.push(`Domluvené coaching úkoly:\n${ctx.coachingTasks.join("\n")}`);
  }
  if (ctx.topicTree.length > 0) {
    parts.push(`Strom témat:\n${ctx.topicTree.join("\n")}`);
  }
  if (ctx.activeTopicTitle) {
    parts.push(`Aktivní téma: ${ctx.activeTopicTitle}`);
  }
  if (ctx.activeTopicNotes.length > 0) {
    parts.push(`Poznámky k aktivnímu tématu:\n${ctx.activeTopicNotes.join("\n")}`);
  }
  if (ctx.growthMilestones.length > 0) {
    parts.push(`Pokroky:\n${ctx.growthMilestones.join("\n")}`);
  }
  if (ctx.voiceSentiment) {
    parts.push(`Emoční tón hlasu: ${ctx.voiceSentiment}`);
  }
  if (ctx.healthTrends) {
    parts.push(`Zdravotní trendy: ${ctx.healthTrends}`);
  }
  if (ctx.assessmentBaseline) {
    parts.push(`Dotazníky: ${ctx.assessmentBaseline}`);
  }
  if (ctx.recentCheckins) {
    parts.push(`Check-iny (7 dní): ${ctx.recentCheckins}`);
  }

  parts.push(`Režim: ${ctx.sessionMode}, Styl: ${ctx.interactionStyle}`);

  return parts.join("\n\n---\n\n");
}
