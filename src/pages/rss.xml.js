import rss from '@astrojs/rss';

const postImportResult = import.meta.glob('./posts/*.md', { eager: true });
const posts = Object.values(postImportResult);
posts.sort((a, b) => new Date(b.frontmatter.date) - new Date(a.frontmatter.date));

export async function GET(context) {
  return rss({
    title: '王忠亮的博客',
    description: '软件工程 · 技术分享 · 学习笔记',
    site: context.site,
    items: posts.map(post => ({
      title: post.frontmatter.title,
      pubDate: new Date(post.frontmatter.date),
      description: post.frontmatter.description,
      link: post.url,
    })),
    customData: '<language>zh-CN</language>',
  });
}
