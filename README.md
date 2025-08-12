# This is a [Next.js](https://nextjs.org) and Supabase project for Credo's EV Charger Management system. 

### Implemented by 2025 summer interns: Hunter Broughton, Kevin Zhang, Farhan Ahmad, and Supragaya Seth at the 2025 Credo Hackathon

Will now be managed and monitored by Credo IT, direct questions and reports to that department. 

Project is open source! If you encounter a bug or would like to improve the software in any way, please create
a pull request and notify the IT team to review it. 

## Tech Stack / Documentation:

- **Styling/css**: tailwind
- **Database/auth**: supabase - github login with it-system@credosemi.com
- **Email Notifications**: SES - account info belongs to IT
- **Frontend Framework**: React/Next.js
- **APIs**: REST and SSE

## Important Note for Supabase:

If no calls are made to the Supabase API in a week, the project will be paused and needs to be reset.

Maintainers must log into supabase through the github (credentials belong to IT) and complete this if it were to occurr. 

## Future Improvements and Recconmendations: 

- The company who supplies the chargers: Chargepoint, may have a private API key for the chargers, which would enhance monitoring accuracy and user experience. If anyone recovers this API key from charge point, and wishes to implement it into the software, please do so.
- Certain edge cases have not been covered and testing for this site is limited. If able, future employees are more than welcome to contribute to this REPO to fix potential pain points while also contibuting testing.  

## Development: Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

