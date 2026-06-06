import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts');
  posts.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());

  return rss({
    title: '王忠亮的博客',
    description: '软件工程 · 技术分享 · 学习笔记',
    site: context.site,
    items: posts.map(post => ({
      title: post.data.title,
      pubDate: post.data.published,
      description: post.data.description,
      link: `/posts/${post.slug}/`,
    })),
    customData: '<language>zh-CN</language>',
  });
}
