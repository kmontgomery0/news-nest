# Web Version Troubleshooting

## "Loading..." Stuck Issue

If you see the iPhone frame but it's stuck on "Loading...", follow these steps:

### 1. Check Browser Console
- Open Developer Tools (F12 or Cmd+Option+I on Mac)
- Go to the **Console** tab
- Look for any red error messages
- Share the error messages to debug

### 2. Check Network Tab
- In Developer Tools, go to the **Network** tab
- Refresh the page
- Check if `bundle.js` is loading (should show 200 status)
- If it's failing, check the error message

### 3. Common Issues

#### Issue: Module not found errors
**Solution:** Clear cache and reinstall
```bash
rm -rf node_modules web/dist
npm install
npm run web
```

#### Issue: Babel/Webpack errors
**Solution:** Check that all dependencies are installed
```bash
npm install --save-dev react-native-web react-dom@^18.2.0 webpack webpack-cli webpack-dev-server html-webpack-plugin babel-loader
```

#### Issue: Port already in use
**Solution:** Change port in `webpack.config.js` or kill the process
```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

#### Issue: Images not loading
**Solution:** Make sure file-loader is processing images correctly. Check that images are in `src/assets/` folder.

### 4. Debug Steps

1. **Check if webpack is building:**
   ```bash
   npm run web
   ```
   You should see webpack compilation output. Look for errors.

2. **Check browser console:**
   - Open http://localhost:3001
   - Open Developer Tools (F12)
   - Check Console for errors
   - Check Network tab to see if bundle.js loaded

3. **Try a simple test:**
   Create a test file `web/test.js`:
   ```javascript
   console.log('Test file loaded!');
   ```
   If this doesn't work, the issue is with webpack setup.

4. **Check webpack output:**
   The terminal should show compilation status. If there are errors, they'll appear there.

### 5. Get Help

When asking for help, please provide:
- Browser console errors (screenshot or copy/paste)
- Webpack terminal output
- Browser and version
- Node version (`node --version`)
- npm version (`npm --version`)

