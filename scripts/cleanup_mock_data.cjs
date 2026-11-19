const mongoose = require('../node_modules/mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/pet_clinic_dev');
  const db = mongoose.connection.db;

  console.log('--- 1. Community Posts Cleanup ---');
  const postsToDelete = await db.collection('community_posts').find({
    $or: [
      { title: 'test', status: 'PENDING' },
      { title: 'Kinh nghiệm nuôi mèo Anh lông ngắn khỏe mạnh', status: 'HIDDEN' }
    ]
  }).toArray();

  console.log(`Found ${postsToDelete.length} duplicate/test community posts to delete.`);
  const postIds = postsToDelete.map(p => p._id);

  if (postIds.length > 0) {
    const commRes = await db.collection('community_posts').deleteMany({
      _id: { $in: postIds }
    });
    console.log(`Deleted ${commRes.deletedCount} community posts.`);

    const commentRes = await db.collection('community_comments').deleteMany({
      postId: { $in: postIds }
    });
    console.log(`Deleted ${commentRes.deletedCount} orphan comments.`);
  }

  console.log('\n--- 2. Publish Complete Official Blog Posts ---');
  const draftUpdateRes = await db.collection('posts').updateOne(
    { _id: new mongoose.Types.ObjectId('6aeace4942f0602f83c5a79e'), status: 'DRAFT' },
    {
      $set: {
        status: 'PUBLISHED',
        publishedAt: new Date('2026-10-25T10:00:00.000Z'),
        isFeatured: false,
        viewCount: 420,
        likesCount: 38
      }
    }
  );
  console.log(`Updated draft post to PUBLISHED: matched ${draftUpdateRes.matchedCount}, modified ${draftUpdateRes.modifiedCount}`);

  console.log('\n--- 3. Verification ---');
  const remainingComm = await db.collection('community_posts').find({}).toArray();
  console.log(`Remaining community posts (${remainingComm.length}):`);
  remainingComm.forEach(c => console.log(`  - [${c.status}] ${c.title}`));

  const allPosts = await db.collection('posts').find({ postType: 'OFFICIAL_BLOG' }).toArray();
  console.log(`\nOfficial blog posts (${allPosts.length}):`);
  allPosts.forEach(p => console.log(`  - [${p.status}] [${p.category}] ${p.title}`));

  await mongoose.disconnect();
  console.log('\nDone!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
