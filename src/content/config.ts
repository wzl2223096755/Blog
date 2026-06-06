import { defineCollection, z } from 'astro:content';

const postsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    published: z.date(),
    tags: z.array(z.string()),
    category: z.string(),
    description: z.string(),
    readingTime: z.string().optional(),
    pinned: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = {
  posts: postsCollection,
};
