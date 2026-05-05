import {
  MaterialCategory,
  MaterialFileType,
  PrismaClient,
  ProgressStatus
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
        mimeType: "text/markdown",
        tags: ["发音", "示例"],
        note: "数据库初始化时写入的示例记录，可随时删除。",
        progressStatus: ProgressStatus.NOT_STARTED,
        progressPercent: 0
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
