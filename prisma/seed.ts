import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const topics = [
  { slug: "tam-su", name: "Tâm sự", description: "Chia sẻ chuyện khó nói" },
  { slug: "giai-tri", name: "Giải trí", description: "Nói chuyện vui, nhẹ nhàng" },
  { slug: "hoc-tap", name: "Học tập", description: "Hỏi bài, chia sẻ cách học" },
  { slug: "hen-ho", name: "Hẹn hò", description: "Làm quen văn minh" },
  { slug: "cong-nghe", name: "Công nghệ", description: "Code, sản phẩm, công cụ mới" },
  { slug: "dem-khuya", name: "Đêm khuya", description: "Tâm sự khi khó ngủ" }
];

async function main() {
  for (const topic of topics) {
    const savedTopic = await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: topic,
      create: topic
    });

    await prisma.room.upsert({
      where: { slug: topic.slug },
      update: {
        topicId: savedTopic.id,
        name: topic.name,
        description: topic.description,
        enabled: true
      },
      create: {
        topicId: savedTopic.id,
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        enabled: true
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
