# Company Search App

A modern Next.js application that provides comprehensive business insights about companies using OpenAI's GPT API.

## Features

- 🔍 **Company Search**: Enter any company name to get detailed business insights
- 🤖 **AI-Powered Analysis**: Uses OpenAI GPT to provide comprehensive company overviews
- 💼 **Job Market Focus**: Includes insights about company culture and job opportunities
- 📱 **Responsive Design**: Modern, clean UI that works on all devices
- ⚡ **Real-time Updates**: Loading states and error handling for smooth UX

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- OpenAI API key

### Installation

1. **Clone the repository** (if needed)
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   # Copy the example environment file
   cp .env.example .env.local
   
   # Edit .env.local and add your OpenAI API key
   OPENAI_API_KEY=your_actual_openai_api_key_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the app**: Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter a company name in the search field (e.g., "Microsoft", "Apple", "Tesla")
2. Click "Search" or press Enter
3. Wait for the AI analysis to complete
4. View comprehensive company insights including:
   - What the company does
   - Industry classification
   - Company size
   - Key strengths
   - Company culture and job market insights

## Tech Stack

- **Framework**: Next.js 16+ with App Router
- **Language**: TypeScript
- **Styling**: SCSS with modern design system
- **API**: OpenAI GPT-3.5-turbo
- **UI**: Custom responsive components

## Project Structure

```
├── app/
│   ├── api/search/
│   │   └── route.ts          # OpenAI API integration
│   ├── page.tsx              # Main search interface
│   ├── page.scss             # Component styles
│   └── layout.tsx            # App layout
├── .env.example              # Environment template
└── package.json              # Dependencies
```

## API Endpoints

### POST `/api/search`

Searches for company information using OpenAI.

**Request Body:**
```json
{
  "companyName": "Microsoft"
}
```

**Response:**
```json
{
  "companyName": "Microsoft",
  "companyInfo": "Detailed company analysis...",
  "success": true
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |

## Development

- **Linting**: `npm run lint`
- **Build**: `npm run build`  
- **Start**: `npm start`

## Features in Detail

### Search Interface
- Clean, centered search input with modern styling
- Real-time validation and feedback
- Disabled states during API calls

### Loading States
- Animated spinner with descriptive text
- Non-blocking UI updates
- Clear progress indication

### Error Handling
- Graceful error messages for API failures
- Network error handling
- Input validation with user feedback

### Results Display
- Formatted company analysis with structured layout
- Bullet-point formatting for easy reading
- Professional company information cards
- "Search Another Company" functionality

## Deployment

The app can be deployed on any platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify**
- **Railway**
- **Digital Ocean**

Make sure to set the `OPENAI_API_KEY` environment variable in your deployment platform.

## License

This project is for educational and demonstration purposes.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
