# Web Version Setup

Your React Native app can now run in a web browser with an iPhone 16 frame for easy testing and sharing!

## Quick Start

1. **Start the web development server:**
   ```bash
   npm run web
   ```

2. **Open your browser:**
   - The app will automatically open at `http://localhost:3001`
   - The app is displayed in an iPhone 16 frame (393px × 852px)

## Features

- ✅ Full React Native app running in the browser
- ✅ iPhone 16 frame with notch for realistic preview
- ✅ Responsive design (scales on smaller screens)
- ✅ Hot reloading for development
- ✅ Same codebase as iOS/Android versions

## Commands

- `npm run web` - Start development server with hot reload
- `npm run web:build` - Build production bundle (outputs to `web/dist/`)

## Sharing with Testers

### Option 1: Local Network
1. Find your computer's IP address:
   - Mac/Linux: `ifconfig | grep "inet "`
   - Windows: `ipconfig`
2. Start the web server: `npm run web`
3. Share the URL: `http://YOUR_IP:3001`
4. Testers can access it from any device on the same network

### Option 2: Deploy to Hosting
1. Build the production bundle:
   ```bash
   npm run web:build
   ```
2. Deploy the `web/dist/` folder to:
   - Netlify
   - Vercel
   - GitHub Pages
   - Any static hosting service

### Option 3: ngrok (Temporary Public URL)
1. Install ngrok: `npm install -g ngrok` or download from ngrok.com
2. Start your web server: `npm run web`
3. In another terminal: `ngrok http 3001`
4. Share the ngrok URL (e.g., `https://abc123.ngrok.io`)

## iPhone 16 Dimensions

The web version displays your app in an iPhone 16 frame:
- **Width:** 393px
- **Height:** 852px
- **Aspect Ratio:** 19.5:9
- **Notch:** Included for realistic preview

On smaller screens, the frame adapts to fit the viewport.

## Troubleshooting

### Images not loading
- Make sure all image assets are in the `src/assets/` folder
- Check that file-loader is processing images correctly

### API not connecting
- Make sure your backend is running on `http://localhost:8000`
- For production, update `src/config/environment.ts`

### Build errors
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear webpack cache: `rm -rf web/dist`

### Port already in use
- Change the port in `webpack.config.js` (line with `port: 3001`)

## Notes

- Some React Native features may not work on web (e.g., native modules)
- The web version uses `react-native-web` which provides web equivalents
- Keyboard behavior may differ slightly from native apps
- Touch events are automatically converted to mouse events

