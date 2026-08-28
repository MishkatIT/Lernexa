const writers = ['admin', 'content-manager'];

export default {
  routes: [
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
