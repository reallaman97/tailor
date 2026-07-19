import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * The real auth boundary. Call this at the top of every server action, route
 * handler, and page that touches user data — proxy.ts only redirects page
 * navigations and does not cover Server Actions.
 */
export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }
  return { id: session.user.id, email: session.user.email };
}
