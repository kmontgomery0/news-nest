# News Nest React Native App

AI-powered news conversation app built with React Native and TypeScript.

## Architecture

This React Native app communicates with a FastAPI backend server via HTTP REST API.

```
React Native App (Frontend)
    ↕ HTTP REST API
FastAPI Backend (Python)
    ↕ Gemini API
Google Gemini AI
```

To kill Metro bundler process
```
lsof -ti:8081 | xargs kill -9
```

## Setup

### 1. Install Dependencies

   ```bash
   npm install
   ```

For iOS, also install CocoaPods:

   ```bash
   cd ios
   pod install
   cd ..
   ```

### 2. Configure Backend Connection

By default, the included client picks:
- **iOS Simulator**: `http://localhost:8000`
- **Android Emulator**: `http://10.0.2.2:8000`
- **Physical Device**: Change `API_BASE` in `src/api/newsNest.js` to your computer's IP, e.g. `http://192.168.1.100:8000`

To find your IP address:
- **macOS/Linux**: `ifconfig | grep "inet "`
- **Windows**: `ipconfig`

### 3. Start Backend Server

The backend must be running before starting the React Native app:

```bash
# Navigate to backend directory
cd ../backend

# Activate virtual environment (if using one)
source .venv/bin/activate

# Start the FastAPI server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The `--host 0.0.0.0` flag allows the server to accept connections from other devices on your network.

### 4. Start React Native App

In a separate terminal:

```bash
# Start Metro bundler
npm start

# Run on iOS (in another terminal)
npm run ios

# Or run on Android
npm run android
```

## Project Structure

```
BasicReactNativeApp/
├── App.tsx                    # Main app entry point
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── Header.tsx
│   │   └── index.ts
│   ├── screens/              # Screen components
│   │   ├── ConversationScreen.tsx
│   │   └── index.ts
│   ├── services/             # API services
│   │   └── api.ts           # Backend API calls
│   ├── styles/               # StyleSheet definitions
│   │   ├── conversationStyles.ts
│   │   ├── headerStyles.ts
│   │   └── index.ts
│   ├── types/                # TypeScript types
│   │   └── index.ts
│   ├── constants/            # App constants
│   │   └── api.ts           # API endpoints
│   ├── config/               # Configuration
│   │   └── environment.ts   # Environment settings
│   └── utils/                # Utility functions
│       └── textUtils.ts
```

## Troubleshooting

### Backend Connection Issues

**Error: "Failed to connect to backend"**

1. Make sure the backend server is running:
   ```bash
   curl http://localhost:8000/agents/list
   ```

2. For physical devices, ensure:
   - Backend server uses `--host 0.0.0.0` flag
   - Your device and computer are on the same Wi-Fi network
   - Update `src/config/environment.ts` with your computer's IP address
   - Check that your firewall allows connections on port 8000

3. For iOS physical device:
   - Update `src/config/environment.ts` to use your IP instead of localhost
   - Ensure Info.plist allows HTTP connections (already configured for localhost)

### Metro Bundler Issues

If Metro bundler has issues:

```bash
npm start -- --reset-cache
```

### iOS Build Issues

If you encounter build issues:

```bash
cd ios
pod install
cd ..
npm run ios
```

## Development

### Adding New Screens

1. Create screen component in `src/screens/YourScreen.tsx`
2. Create styles in `src/styles/yourScreenStyles.ts`
3. Export from `src/screens/index.ts`
4. Import and use in `App.tsx` or navigation setup

### API Integration

Basic usage with Polly (top 10 headlines on first message are handled by backend):

```tsx
import { useState } from 'react';
import { chatWithPolly } from './src/api/newsNest';

export default function ExampleUsage() {
  const [articlesPreview, setArticlesPreview] = useState('');

  async function onPress() {
    try {
      const res = await chatWithPolly('What are the headlines today?');
      // res.response contains Polly's formatted message
      setArticlesPreview(res.response);
    } catch (e) {
      console.warn('Chat failed', e);
    }
  }

  // Render a button and text using your UI components…
  return null;
}
```

Available backend endpoints you can call:
- `POST /agents/chat` - Direct chat with an agent (`polly`, `flynn`, `pixel`, `cato`)
- `POST /agents/route-only` - Get routing info, then call `/agents/chat` yourself
- `POST /agents/chat-and-route` - Combined routing + response
- `GET /agents/list` - List available agents
- `GET /news` - Fetch news articles (general fetch)

## Backend Requirements

The backend must be running and accessible at the URL specified in `src/config/environment.ts`.

Required backend endpoints:
- `/agents/chat-and-route` - Main chat endpoint with routing
- `/agents/list` - List of available agents

See `../backend/README.md` for backend setup instructions.
