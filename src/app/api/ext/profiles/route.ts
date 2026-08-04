import { NextResponse } from "next/server";
import { getExtUser } from "@/lib/ext/session";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { getProfileNames } from "@/lib/profile/personal-info";
import { listAllProfiles } from "@/lib/admin/profiles";

/** Extension: the candidate profiles this user may build a resume for. */
export async function GET() {
  const user = await getExtUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (user.role === "SUPERADMIN") {
    const profiles = await listAllProfiles();
    return NextResponse.json({
      profiles: profiles.map((p) => ({ id: p.id, name: p.fullName ?? "Untitled profile" })),
    });
  }

  // Bidder: only their assigned profile (if one is assigned).
  const profileId = await getAssignedProfileId(user.id);
  if (!profileId) return NextResponse.json({ profiles: [] });
  const names = await getProfileNames([profileId]);
  return NextResponse.json({ profiles: [{ id: profileId, name: names.get(profileId) ?? "Your profile" }] });
}
