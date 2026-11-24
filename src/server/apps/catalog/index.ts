/** Every app, in display order. Add an app by adding one entry to one of these lists. */
import type { AppDef } from "../types";
import { effectApps } from "./effects";
import { imageApps } from "./image";
import { soonApps } from "./soon";
import { templateApps } from "./templates";
import { videoApps } from "./video";

export const apps: AppDef[] = [...imageApps, ...videoApps, ...effectApps, ...templateApps, ...soonApps];
