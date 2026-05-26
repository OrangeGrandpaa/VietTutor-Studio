import {
  MaterialCategory,
  MaterialFileType,
  PrismaClient
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const materialsCount = await prisma.courseMaterial.count();

  if (materialsCount === 0) {
    await prisma.courseMaterial.create({
      data: {
        title: "示例课件：越南语发音清单",
        fileName: "sample-pronunciation.md",
        filePath: "seed/sample-pronunciation.md",
        fileType: MaterialFileType.MARKDOWN,
        category: MaterialCategory.PRONUNCIATION,
        mimeType: "text/markdown"
      }
    });
  }
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
