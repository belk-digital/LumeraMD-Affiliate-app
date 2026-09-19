import "dotenv/config";
import { prisma } from "../src/lib/prisma";
prisma.affiliate.findMany({ select: { userEmail: true, parentOverrideRate: true } }).then((r) => console.log(r)).finally(() => prisma.$disconnect());
