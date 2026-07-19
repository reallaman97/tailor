import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateDek, wrapDek } from "@/lib/crypto/envelope";

const [, , mode, email] = process.argv;

async function main() {
  if (mode === "create") {
    const passwordHash = await hashPassword("correct-horse-battery-staple");
    const encryptedDek = wrapDek(generateDek());
    const user = await db.user.create({
      data: { email, passwordHash, encryptedDek },
    });
    console.log(`created user ${user.id} ${user.email}`);
  } else if (mode === "delete") {
    await db.user.deleteMany({ where: { email } });
    console.log(`deleted user(s) with email ${email}`);
  } else {
    throw new Error("usage: tsx scripts/manage-test-user.ts <create|delete> <email>");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
