import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.agent.upsert({
    where: { email: "admin@alpha.com" },
    update: {},
    create: {
      name: "Test Agent",
      email: "admin@alpha.com",
      passwordHash,
      phone: "",
    },
  });

  console.log("Seed complete: admin@alpha.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
