import { HomePage } from "@/components/home/home-page";
import { AppShell } from "@/components/shell/app-shell";

/** The front door. Everything on it is drawn in the browser from the public API. */
export default function Home() {
  return (
    <AppShell active="explore" nav="full" footer>
      <HomePage />
    </AppShell>
  );
}
