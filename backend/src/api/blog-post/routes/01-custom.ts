const writers = ['admin', 'content-manager'];

export default {
  routes: [
    // Public aggregate for the topic bar. Three path segments so it can never be
    // read as `/blog-posts/:id`. Permission granted to everyone via BLOG_READ.
    {
      method: 'GET',
      path: '/blog-posts/counts/by-category',
      handler: 'blog-post.categoryCounts',
    },
    {
      method: 'POST',
      path: '/blog-posts/:id/publish',
      handler: 'blog-post.publish',
      config: { policies: [{ name: 'global::has-role', config: { roles: writers } }] },
    },
    {
      method: 'POST',
      path: '/blog-posts/:id/unpublish',
      handler: 'blog-post.unpublish',
      config: { policies: [{ name: 'global::has-role', config: { roles: writers } }] },
    },
  ],
};
