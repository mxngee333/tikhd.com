import blogMetaJson from "./blog-meta.json";

export interface BlogPostMeta {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  thumbnail: string;
  date: string;
  readTime: string;
  author: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  wordCount: number;
  content?: string;
}

export const blogPosts: BlogPostMeta[] = blogMetaJson as any as BlogPostMeta[];
