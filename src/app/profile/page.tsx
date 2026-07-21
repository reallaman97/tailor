import { redirect } from "next/navigation";

// The bidder's profile view is merged into the My Account page.
export default function ProfilePage() {
  redirect("/account");
}
