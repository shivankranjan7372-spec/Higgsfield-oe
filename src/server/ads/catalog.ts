import { getModel, quoteJob, resolveValues } from "@/registry";
import { FORMATS, formatUsable, fullSlots, type AdFormat } from "./formats";

/** The format catalog as the screens see it, with a typical price per ad. */

function typicalPrice(f: AdFormat): number {
  // Spoken formats are priced on a sample script of the format's length; the real quote uses the real script.
  const sample = f.spoken ? "word ".repeat(Math.round((f.platform.seconds ?? 20) * 2.5)).trim() : "sample ad prompt";
  const filled = fullSlots(f);
  const price = (modelId: string, values: AdFormat["values"], fill: typeof filled) => {
    const m = getModel(modelId)!;
    return quoteJob(m, { prompt: sample, values: resolveValues(m, values, fill), filled: fill, count: 1 }).millicredits;
  };
  return price(f.modelId, f.values, filled) + (f.speech ? price(f.speech.modelId, f.speech.values, {}) : 0);
}

export function formatCatalog() {
  return FORMATS.map((f) => {
    const available = formatUsable(f);
    const model = getModel(f.modelId);
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      output: f.output,
      group: f.group,
      platform: f.platform,
      modelId: f.modelId,
      modelName: model?.name ?? f.modelId,
      speechModelId: f.speech?.modelId ?? null,
      values: f.values,
      slots: f.slots.map((s) => ({ slot: s.slot, from: s.from, max: s.max, required: s.required, label: model?.slots.find((m) => m.id === s.slot)?.label ?? s.slot })),
      needsPresenter: f.slots.some((s) => s.from === "presenter" && s.required),
      usesProductImages: f.slots.some((s) => s.from === "product-images"),
      spoken: f.spoken,
      available,
      pricePerAd: available ? typicalPrice(f) : null,
    };
  });
}
