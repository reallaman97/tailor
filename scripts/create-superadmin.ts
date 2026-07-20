import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateDek, wrapDek } from "@/lib/crypto/envelope";

const email = process.argv[2];
const password = process.argv[3];

async function main() {
  if (!email || !password) {
    throw new Error("usage: tsx scripts/create-superadmin.ts <email> <password>");
  }

  const passwordHash = await hashPassword(password);
  const encryptedDek = wrapDek(generateDek());

  const user = await db.user.upsert({
    where: { email },
    create: { email, passwordHash, encryptedDek, role: "SUPERADMIN", approved: true },
    update: { passwordHash, role: "SUPERADMIN", approved: true },
  });

  console.log(`superadmin ready: ${user.email} (role: ${user.role})`);
}

main().finally(() => db.$disconnect());
