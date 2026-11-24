import type { Metadata } from "next";
import { CinemaStudio } from "@/components/cinema/cinema-studio";
import { cinema } from "@/content/cinema";

export const metadata: Metadata = { title: cinema.title };

export default function CinemaPage() {
  return <CinemaStudio />;
}
