# Andre2 Frontend

Frontend application for the Andre2 music sharing app. A real-time collaborative music player built with Next.js.

## Features

- **Spotify Integration**: Login with Spotify to access your music library
- **Real-time Collaboration**: Share and control music playback in real-time
- **Session Management**: Create and join music sessions
- **Listener Mode**: Join as a listener without Spotify account
- **Interactive UI**: Modern, responsive design with Tailwind CSS
- **Airhorn Sounds**: Fun interactive sound effects

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **WebSocket Client** - Real-time communication

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Backend server running (andre2-backend)

## Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure backend URL**

   Update the backend API URL in your environment or configuration files if needed. Default assumes backend is running on `http://localhost:3001`.

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at http://localhost:3000

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Usage

1. **Login**: Choose between Spotify login or listener-only mode
2. **Create/Join Session**: Start a new music session or join an existing one
3. **Add Tracks**: Search and add tracks from Spotify to the queue
4. **Control Playback**: Play, pause, skip tracks with real-time sync
5. **Collaborate**: Other users can join and contribute to the playlist

## Deployment

Deploy to any static hosting or serverless platform:
- Vercel (recommended for Next.js)
- Netlify
- AWS Amplify
- Cloudflare Pages

**Note**: Ensure your backend WebSocket URL is properly configured for production.

## License

ISC
