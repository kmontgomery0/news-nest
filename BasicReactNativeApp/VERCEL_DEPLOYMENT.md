# Deploying to Vercel

This guide will walk you through deploying your React Native web app to Vercel.

## Prerequisites

1. **Vercel Account**
   - Sign up at: https://vercel.com
   - Or use GitHub/GitLab/Bitbucket to sign in

2. **Git Repository**
   - Your code should be in a Git repository (GitHub, GitLab, or Bitbucket)
   - All web-related files should be committed

## Method 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Prepare Your Repository
1. Make sure all your web files are committed:
   ```bash
   git add .
   git commit -m "Add web version for Vercel deployment"
   git push
   ```

### Step 2: Import Project to Vercel
1. Go to https://vercel.com/new
2. Import your Git repository (GitHub/GitLab/Bitbucket)
3. Vercel will auto-detect the project

### Step 3: Configure Build Settings
If Vercel doesn't auto-detect, configure manually:

- **Framework Preset**: Other
- **Root Directory**: `BasicReactNativeApp` (or leave blank if deploying from root)
- **Build Command**: `npm run web:build`
- **Output Directory**: `web/dist`
- **Install Command**: `npm install`

### Step 4: Environment Variables (Optional)
If your app needs environment variables:
1. Go to Project Settings → Environment Variables
2. Add any required variables (e.g., API URLs)

### Step 5: Deploy
1. Click "Deploy"
2. Wait for the build to complete
3. Your app will be live at `your-project.vercel.app`

## Method 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login
```bash
vercel login
```

### Step 3: Deploy
From the project root:
```bash
cd BasicReactNativeApp
vercel
```

Or from the BasicReactNativeApp directory:
```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? (Select your account)
- Link to existing project? **No** (first time) or **Yes** (subsequent deployments)
- Project name? (Enter a name or press Enter for default)
- Directory? `web/dist` or `.` (Vercel will detect from vercel.json)

### Step 4: Production Deploy
For production deployment:
```bash
vercel --prod
```

## Configuration

The `vercel.json` file is already configured with:
- ✅ Build command: `npm run web:build`
- ✅ Output directory: `web/dist`
- ✅ SPA routing (all routes redirect to index.html)
- ✅ Cache headers for assets and fonts

## Custom Domain

1. Go to your project on Vercel dashboard
2. Click **Settings** → **Domains**
3. Add your custom domain
4. Follow DNS configuration instructions

## Environment Variables

If you need different API URLs for production:

1. Go to **Project Settings** → **Environment Variables**
2. Add variables like:
   - `REACT_APP_API_URL` (if using Create React App style)
   - Or update `src/config/environment.ts` to read from `process.env`

## Updating Your App

### Automatic Deployments
- Every push to your main branch automatically deploys
- Pull requests get preview deployments

### Manual Deployment
```bash
vercel --prod
```

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node version (Vercel uses Node 18.x by default)

### Assets Not Loading
- Check that `publicPath: '/'` is set in webpack.config.js
- Verify asset paths in the built files

### Routing Issues
- The `vercel.json` already includes SPA routing rewrites
- All routes should redirect to `index.html`

### Font Not Loading
- Ensure font file is committed to Git
- Check that font path in CSS matches the built output

## Build Optimization

The production build includes:
- Minified JavaScript
- Optimized assets
- Source maps (for debugging)

To disable source maps in production, update `webpack.config.js`:
```javascript
devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
```

## Preview URLs

Every deployment gets:
- **Production**: `your-project.vercel.app`
- **Preview**: Unique URL for each branch/PR

Share preview URLs with testers before merging!

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Test the live URL
3. ✅ Set up custom domain (optional)
4. ✅ Configure environment variables (if needed)
5. ✅ Share with testers!

Your app will be accessible at: `https://your-project.vercel.app`

