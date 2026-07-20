import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';


export default function Home() {
  // Directly redirect to the dashboard as authentication is no longer required
  redirect('/dashboard');
}
