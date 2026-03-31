import { describe, expect, it } from "vitest";
import { __onboardingTestUtils } from "@/agents/orchestrator";

describe("onboarding state machine helpers", () => {
  it("maps legacy phases to current phase ids", () => {
    expect(__onboardingTestUtils.mapLegacyPhaseToCurrent("A")).toBe("reason");
    expect(__onboardingTestUtils.mapLegacyPhaseToCurrent("B")).toBe(
      "deep_dive"
    );
    expect(__onboardingTestUtils.mapLegacyPhaseToCurrent("C")).toBe(
      "interaction_style"
    );
    expect(__onboardingTestUtils.mapLegacyPhaseToCurrent("summary")).toBe(
      "summary"
    );
  });

  it("normalizes covered areas to known phase ids", () => {
    expect(
      __onboardingTestUtils.normalizeCoveredAreas([
        "reason",
        "life_situation",
        "invalid",
      ])
    ).toEqual(["reason", "life_situation"]);
    expect(__onboardingTestUtils.normalizeCoveredAreas(null)).toEqual([]);
  });

  it("resolves current phase from stored state", () => {
    expect(__onboardingTestUtils.resolveCurrentOnboardingPhase("A", [])).toBe(
      "reason"
    );
    expect(
      __onboardingTestUtils.resolveCurrentOnboardingPhase(
        "summary_review",
        ["reason"]
      )
    ).toBe("summary_review");
    expect(
      __onboardingTestUtils.resolveCurrentOnboardingPhase(
        "unknown",
        ["reason", "life_situation"]
      )
    ).toBe("areas_rating");
  });

  it("computes next phase and review transition", () => {
    expect(__onboardingTestUtils.getNextOnboardingPhase("reason")).toBe(
      "life_situation"
    );
    expect(__onboardingTestUtils.getNextOnboardingPhase("summary")).toBe(
      __onboardingTestUtils.ONBOARDING_REVIEW_PHASE
    );
  });

  it("detects summary confirmations robustly", () => {
    expect(__onboardingTestUtils.isSummaryConfirmed("Ano, sedí to.")).toBe(
      true
    );
    expect(__onboardingTestUtils.isSummaryConfirmed("Ne, nesedí to.")).toBe(
      false
    );
  });

  it("checks required phase coverage fallback", () => {
    expect(
      __onboardingTestUtils.hasAllRequiredOnboardingPhases(
        __onboardingTestUtils.ONBOARDING_PHASE_IDS
      )
    ).toBe(true);
    expect(
      __onboardingTestUtils.hasAllRequiredOnboardingPhases(["reason"])
    ).toBe(false);
  });
});
