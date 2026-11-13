// const { PrismaClient } = require("@prisma/client");

// const prisma = new PrismaClient();

// module.exports = prisma;



const { PrismaClient } = require("../generated/prisma");

// Shared Prisma Client instance for all backend modules.
const prisma = new PrismaClient();

module.exports = prisma;

