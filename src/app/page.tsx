import { redirect } from "next/navigation";

// ponytail: no landing page yet; root sends users into the app. Auth gate added in Phase 3.
export default function Home() {
  redirect("/dashboard");
}
