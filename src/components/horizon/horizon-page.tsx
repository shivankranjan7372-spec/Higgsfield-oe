import { HorizonCloser } from "./closer";
import { HorizonGet } from "./get";
import { HorizonHero } from "./hero";
import { HorizonLook } from "./look";
import { HorizonSteps } from "./steps";

/** The Horizon announcement page, section by section. */
export function HorizonPage() {
  return (
    <div className="flex w-full min-w-0 flex-col overflow-x-clip bg-black">
      <HorizonHero />
      <HorizonSteps />
      <HorizonLook />
      <HorizonCloser />
      <HorizonGet />
    </div>
  );
}
