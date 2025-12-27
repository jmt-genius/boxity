# Auth0 Setup Instructions

## Important: Configure Callback URLs in Auth0 Dashboard

To fix the "Callback URL mismatch" error, you need to add your application's callback URLs in the Auth0 Dashboard:

### Steps:

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **Applications** → Your Application (or create one)
3. Go to **Settings** tab
4. Scroll down to **Allowed Callback URLs**
5. Add the following URLs (one per line):
   ```
   http://localhost:8080/callback
   http://localhost:8080/
   http://localhost:8080
   http://localhost:3000/callback
   http://localhost:3000/
   http://localhost:3000
   https://your-production-domain.com/callback
   https://your-production-domain.com/
   https://your-production-domain.com
   ```
6. Scroll to **Allowed Logout URLs** and add:
   ```
   http://localhost:8080/
   http://localhost:8080
   http://localhost:3000/
   http://localhost:3000
   https://your-production-domain.com/
   https://your-production-domain.com
   ```
7. Scroll to **Allowed Web Origins** and add:
   ```
   http://localhost:8080
   http://localhost:3000
   https://your-production-domain.com
   ```
8. Click **Save Changes**

### Environment Variables

Make sure these are set in your `.env` file or environment:

```env
VITE_AUTH0_DOMAIN=dev-s3i27lzn7dyxx1wn.us.auth0.com
VITE_AUTH0_CLIENT_ID=Cj5gX5DefENe5HAea91BmcXzxJvxWHUw
VITE_AUTH0_AUDIENCE=https://api.boxity.app
VITE_AUTH0_NAMESPACE=https://boxity.app
VITE_API_URL=https://api.boxity.app
```

### Enable Connections in Auth0

1. Go to **Authentication** → **Database** → Create or enable "Username-Password-Authentication"
2. Go to **Authentication** → **Social** → Enable:
   - Google (google-oauth2)
   - Apple (apple) - if needed
3. Go to **Authentication** → **Passwordless** → Enable:
   - Email (email)

### Test the Flow

1. Start your dev server: `npm run dev`
2. Navigate to `http://localhost:8080/login`
3. Select a role
4. Try signing up with Google or Email
5. You should be redirected to Auth0, then back to your app

