import { db } from "@/lib/db";
import { unwrapDek } from "@/lib/crypto/envelope";

export async function getUserDek(userId: string): Promise<Buffer> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { encryptedDek: true },
  });
  return unwrapDek(user.encryptedDek);
}
