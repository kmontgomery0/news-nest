# Basic React Native App

A simple React Native application that runs on both iOS and Android platforms.

## Features

- Cross-platform compatibility (iOS & Android)
- TypeScript support
- Simple counter example
- Modern UI with beautiful styling
- Hot reloading for fast development

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### For Both Platforms:
- **Node.js** (version 16 or newer)
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
- **Watchman** (recommended for macOS)
  - Install via Homebrew: `brew install watchman`

### For iOS Development (macOS only):
- **Xcode** (version 12 or newer)
  - Install from the Mac App Store
  - Install Xcode Command Line Tools: `xcode-select --install`
- **CocoaPods**
  - Install via: `sudo gem install cocoapods`
  - Verify installation: `pod --version`

### For Android Development:
- **Android Studio**
  - Download from [developer.android.com/studio](https://developer.android.com/studio)
  - During installation, ensure the following are checked:
    - Android SDK
    - Android SDK Platform
    - Android Virtual Device (AVD)
- **Java Development Kit (JDK)**
  - JDK 11 is recommended
  - Set JAVA_HOME environment variable

### Android Environment Setup:

Add the following to your `~/.zshrc` or `~/.bash_profile`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Then reload your shell configuration:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd /Users/krystalmontgomery/Documents/MIT/extra/BasicReactNativeApp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install iOS dependencies (macOS only):**
   ```bash
   cd ios
   pod install
   cd ..
   ```

## Running the App

### Option 1: Using React Native CLI

#### For iOS (macOS only):
```bash
npm run ios
```

Or specify a simulator:
```bash
npm run ios -- --simulator="iPhone 15 Pro"
```

#### For Android:
First, start an Android emulator from Android Studio, or connect a physical device with USB debugging enabled.

Then run:
```bash
npm run android
```

### Option 2: Manual Start

1. **Start the Metro bundler:**
   ```bash
   npm start
   ```

2. **In a new terminal, run the app:**
   - For iOS: `npm run ios`
   - For Android: `npm run android`

## Running on Physical Devices

### iOS:
1. Connect your iPhone via USB
2. Open `ios/BasicReactNativeApp.xcworkspace` in Xcode
3. Select your device from the device dropdown
4. Click the Run button (or press Cmd+R)
5. Trust the developer certificate on your device (Settings > General > Device Management)

### Android:
1. Enable Developer Options on your Android device:
   - Go to Settings > About Phone
   - Tap Build Number 7 times
2. Enable USB Debugging in Developer Options
3. Connect your device via USB
4. Verify device connection: `adb devices`
5. Run: `npm run android`

## Development Tips

### Reloading the App:
- **iOS**: Press `Cmd+R` in the simulator
- **Android**: Press `R` twice or shake the device and select "Reload"

### Opening Developer Menu:
- **iOS**: Press `Cmd+D` in the simulator
- **Android**: Press `Cmd+M` (macOS) / `Ctrl+M` (Windows/Linux) or shake the device

### Debugging:
- Open the developer menu and select "Debug"
- Chrome DevTools will open for debugging
- Use `console.log()` statements to see output in the Metro bundler terminal

## Project Structure

```
BasicReactNativeApp/
├── android/                 # Android native code
├── ios/                     # iOS native code
├── node_modules/           # Dependencies
├── App.tsx                 # Main application component
├── index.js                # Application entry point
├── package.json            # Dependencies and scripts
├── app.json                # App configuration
├── babel.config.js         # Babel configuration
├── metro.config.js         # Metro bundler configuration
├── tsconfig.json           # TypeScript configuration
└── README.md              # This file
```

## Troubleshooting

### Metro Bundler Issues:
```bash
# Clear cache and restart
npm start -- --reset-cache
```

### iOS Build Failures:
```bash
# Clean build folder
cd ios
xcodebuild clean
pod deintegrate
pod install
cd ..
```

### Android Build Failures:
```bash
# Clean Android build
cd android
./gradlew clean
cd ..
```

### Common Issues:

1. **"Unable to resolve module"**: Run `npm install` and restart Metro bundler
2. **iOS Simulator not starting**: Open Xcode and ensure simulators are installed
3. **Android emulator not detected**: Check that `adb devices` shows your device/emulator
4. **Port 8081 already in use**: Kill the Metro process: `lsof -ti:8081 | xargs kill`

## Next Steps

Now that you have a basic React Native app running, you can:

1. **Modify the UI**: Edit `App.tsx` to customize the interface
2. **Add Navigation**: Install React Navigation for multi-screen apps
3. **Add State Management**: Consider Redux or MobX for complex state
4. **Add Icons**: Install react-native-vector-icons
5. **Style Your App**: Explore styled-components or other styling solutions

## Useful Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Native Directory](https://reactnative.directory/) - Find libraries
- [Expo Documentation](https://docs.expo.dev/) - Alternative React Native framework
- [React Native Community](https://github.com/react-native-community)

## License

MIT License - feel free to use this app as a starting point for your projects!

