import { AppRegistry } from 'react-native';
import App from '../App';
import { name as appName } from '../app.json';

// Import font file so webpack processes it
import patrickHandFont from '../src/assets/fonts/PatrickHand-Regular.ttf';

// Add font-face declaration dynamically
const fontFace = new FontFace(
  'Patrick Hand',
  `url(${patrickHandFont}) format('truetype')`
);
fontFace.load().then((loadedFont) => {
  document.fonts.add(loadedFont);
}).catch((error) => {
  console.warn('Failed to load Patrick Hand font:', error);
});

// Register the app
AppRegistry.registerComponent(appName, () => App);

// Wait for DOM to be ready, then start the app
function startApp() {
  const rootTag = document.getElementById('root');
  
  if (!rootTag) {
    console.error('Root element not found!');
    return;
  }

  try {
    // Clear the loading message
    rootTag.innerHTML = '';
    
    AppRegistry.runApplication(appName, {
      initialProps: {},
      rootTag,
    });
  } catch (error) {
    console.error('Error starting app:', error);
    rootTag.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h2>Error Loading App</h2>
        <pre>${error.toString()}</pre>
        <p>Check the browser console for more details.</p>
      </div>
    `;
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

