# Quick Start Guide - Running in Xcode

## Steps to Run Your iOS App

### 1. Install Dependencies
First, navigate to the project directory and install all dependencies:

```bash
cd /Users/krystalmontgomery/Documents/MIT/news-nest/BasicReactNativeApp
npm install
```

### 2. Install iOS Dependencies (CocoaPods)
```bash
cd ios
pod install
cd ..
```

This will create a `BasicReactNativeApp.xcworkspace` file in the ios folder.

### 3. Start Metro Bundler
In one terminal window, start the Metro bundler:

```bash
npm start
```

Keep this running in the background.

### 4. Open in Xcode
**IMPORTANT:** Open the `.xcworkspace` file, NOT the `.xcodeproj` file!

```bash
open ios/BasicReactNativeApp.xcworkspace
```

Or you can:
- Launch Xcode
- File → Open
- Navigate to: `/Users/krystalmontgomery/Documents/MIT/news-nest/BasicReactNativeApp/ios/`
- Select `BasicReactNativeApp.xcworkspace` (not .xcodeproj!)

### 5. Select a Simulator
- At the top of Xcode, click the device dropdown (next to the scheme)
- Select an iOS simulator (e.g., "iPhone 15 Pro")
- If no simulators appear, go to Xcode → Settings → Platforms and download iOS simulators

### 6. Build and Run
- Click the **Play button** (▶️) in the top left, or press **Cmd+R**
- Xcode will compile the app and launch it in the simulator

### 7. Wait for the App to Load
- The simulator will open and show your launch screen
- Metro bundler will bundle the JavaScript
- Your app should appear with the counter example!

## Troubleshooting

### If Metro bundler isn't running:
Make sure you started it with `npm start` in a separate terminal.

### If you see "No bundle URL present":
- Make sure Metro is running
- Try cleaning the build: Product → Clean Build Folder (Cmd+Shift+K)
- Rebuild the app

### If CocoaPods fails:
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### If you get signing errors:
- In Xcode, select the project in the left sidebar
- Select the "BasicReactNativeApp" target
- Go to "Signing & Capabilities"
- Select your development team or check "Automatically manage signing"

### Reset everything:
```bash
# Clean npm
rm -rf node_modules
npm install

# Clean iOS
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..

# Restart Metro
npm start -- --reset-cache
```

## Development Tips

### Hot Reloading
- Press **Cmd+R** in the simulator to reload
- Press **Cmd+D** to open the developer menu
- Enable "Fast Refresh" for automatic reloading

### Debugging
- Press **Cmd+D** in the simulator
- Select "Debug" to open Chrome DevTools
- Use `console.log()` to see output in Metro terminal

### Editing the App
- Edit `App.tsx` to change the UI
- Save the file and it will automatically reload (if Fast Refresh is enabled)

## Next Steps

Once you have the app running, you can:
1. Modify the counter example in `App.tsx`
2. Add more screens and navigation
3. Install additional packages from npm
4. Customize the styling
5. Add app icons in `ios/BasicReactNativeApp/Images.xcassets/AppIcon.appiconset/`

Happy coding! 🚀

