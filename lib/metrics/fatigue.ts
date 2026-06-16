export type FatigueCategory = "Low" | "Moderate" | "High" | "Very high" | "Insufficient data";

export type FatigueInput = {
  sleepDuration?: number | null;
  sleepQuality?: number | null;
  stress?: number | null;
  readiness?: number | null;
  manualFatigue?: number | null;
  sorenessJointIrritation?: number | null;
};

export type FatigueSummary = {
  score: number | null;
  category: FatigueCategory;
  components: Array<{ label: string; score: number }>;
};

function scaleInverse(value: number) {
  return ((5 - value) / 4) * 100;
}

function scaleDirect(value: number) {
  return ((value - 1) / 4) * 100;
}

function sleepDurationScore(hours: number) {
  if (hours >= 7.5) return 0;
  if (hours >= 6.5) return 25;
  if (hours >= 5.5) return 60;
  return 100;
}

function categoryFromScore(score: number | null): FatigueCategory {
  if (score === null) return "Insufficient data";
  if (score < 25) return "Low";
  if (score < 50) return "Moderate";
  if (score < 75) return "High";
  return "Very high";
}

export function calculateFatigueSummary(input: FatigueInput): FatigueSummary {
  const components: Array<{ label: string; score: number }> = [];

  if (typeof input.sleepDuration === "number") components.push({ label: "Sleep duration", score: sleepDurationScore(input.sleepDuration) });
  if (typeof input.sleepQuality === "number") components.push({ label: "Sleep quality", score: scaleInverse(input.sleepQuality) });
  if (typeof input.stress === "number") components.push({ label: "Stress", score: scaleDirect(input.stress) });
  if (typeof input.readiness === "number") components.push({ label: "Readiness", score: scaleInverse(input.readiness) });
  if (typeof input.manualFatigue === "number") components.push({ label: "Manual fatigue", score: scaleDirect(input.manualFatigue) });
  if (typeof input.sorenessJointIrritation === "number") {
    components.push({ label: "Soreness / joint irritation", score: scaleDirect(input.sorenessJointIrritation) });
  }

  if (components.length === 0) return { score: null, category: "Insufficient data", components };

  const score = Math.round(components.reduce((sum, item) => sum + item.score, 0) / components.length);
  return { score, category: categoryFromScore(score), components };
}
