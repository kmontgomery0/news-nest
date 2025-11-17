export interface Bird {
  id: string;
  name: string;
  category: string;
  image: any;
  welcomeMessage: string;
  agentName?: string; // For backend routing
}

export const BIRDS: Bird[] = [
  {
    id: 'polly',
    name: 'Polly the Parrot',
    category: 'General News',
    image: require('../assets/parrot.jpeg'),
    welcomeMessage: "Hi! I'm Polly, your friendly news anchor. Ready for your daily news feed? Ask me about today's top headlines, and I'll help you stay informed!",
    agentName: 'Polly the Parrot',
  },
  {
    id: 'flynn',
    name: 'Flynn the Falcon',
    category: 'Sports News',
    image: require('../assets/falcon.png'),
    welcomeMessage: "Hey! I'm Flynn, your sports commentator. I cover scores, highlights, and all the action from the world of sports. What game or team are you curious about?",
    agentName: 'Flynn the Falcon',
  },
  {
    id: 'pixel',
    name: 'Pixel the Pigeon',
    category: 'Technology News',
    image: require('../assets/pigeon.png'),
    welcomeMessage: "Hey there! I'm Pixel, your tech guide. I love explaining how new gadgets, apps, and innovations work in simple terms. What tech topic interests you today?",
    agentName: 'Pixel the Pigeon',
  },
  {
    id: 'cato',
    name: 'Cato the Crane',
    category: 'Political News',
    image: require('../assets/crane.png'),
    welcomeMessage: "Hello! I'm Cato, and I help explain political events, elections, and civic matters in a balanced, easy-to-understand way. What would you like to learn about?",
    agentName: 'Cato the Crane',
  },
  {
    id: 'pizzazz',
    name: 'Pizzazz the Peacock',
    category: 'Entertainment & Pop Culture News',
    image: require('../assets/peacock.png'),
    welcomeMessage: "Hi! I'm Pizzazz, your entertainment guide. I keep you updated on the latest in movies, music, TV shows, and pop culture. What's catching your interest?",
    agentName: undefined, // Not yet implemented in backend
  },
  {
    id: 'edwin',
    name: 'Edwin the Eagle',
    category: 'Business News',
    image: require('../assets/eagle.png'),
    welcomeMessage: "Hello! I'm Edwin, your business news expert. I cover markets, companies, and economic trends that matter. What business topic would you like to explore?",
    agentName: undefined, // Not yet implemented in backend
  },
  {
    id: 'credo',
    name: 'Credo the Crow',
    category: 'Crime & Legal News',
    image: require('../assets/crow.png'),
    welcomeMessage: "Hey! I'm Credo, and I help explain legal matters and crime news in a clear, balanced way. What legal or crime-related topic interests you?",
    agentName: undefined, // Not yet implemented in backend
  },
  {
    id: 'gaia',
    name: 'Gaia the Goose',
    category: 'Science & Environmental News',
    image: require('../assets/goose.png'),
    welcomeMessage: "Hi! I'm Gaia, your science and environment guide. I cover discoveries, climate news, and environmental stories. What would you like to learn about?",
    agentName: undefined, // Not yet implemented in backend
  },
  {
    id: 'happy',
    name: 'Happy the Hummingbird',
    category: 'Feel-Good News',
    image: require('../assets/hummingbird.png'),
    welcomeMessage: "Hi! I'm Happy, and I specialize in uplifting stories and positive news. Ready to brighten your day with some feel-good updates?",
    agentName: undefined, // Not yet implemented in backend
  },
  {
    id: 'omni',
    name: 'Omni the Owl',
    category: 'Historical Trends',
    image: require('../assets/owl.png'),
    welcomeMessage: "Hello! I'm Omni, and I help you understand how today's news connects to historical patterns and trends. What would you like to explore?",
    agentName: undefined, // Not yet implemented in backend
  },
];

// Map of agent names to their bird images
export const BIRD_IMAGE_MAP: Record<string, any> = {
  'Polly the Parrot': require('../assets/parrot.jpeg'),
  'Flynn the Falcon': require('../assets/falcon.png'),
  'Pixel the Pigeon': require('../assets/pigeon.png'),
  'Cato the Crane': require('../assets/crane.png'),
  'Pizzazz the Peacock': require('../assets/peacock.png'),
  'Edwin the Eagle': require('../assets/eagle.png'),
  'Credo the Crow': require('../assets/crow.png'),
  'Gaia the Goose': require('../assets/goose.png'),
  'Happy the Hummingbird': require('../assets/hummingbird.png'),
  'Omni the Owl': require('../assets/owl.png'),
};

// Map of agent names to their custom image shift positions {left, top}
export const BIRD_IMAGE_SHIFTS: Record<string, {left: number; top: number}> = {
  'Polly the Parrot': {left: 5, top: 2},
  'Flynn the Falcon': {left: 5, top: 2},
  'Pixel the Pigeon': {left: 5, top: 2},
  'Cato the Crane': {left: 5, top: 2},
  'Pizzazz the Peacock': {left: 5, top: 2},
  'Edwin the Eagle': {left: 5, top: 2},
  'Credo the Crow': {left: 5, top: 2},
  'Gaia the Goose': {left: 5, top: 2},
  'Happy the Hummingbird': {left: 5, top: 2},
  'Omni the Owl': {left: 5, top: 2},
};

