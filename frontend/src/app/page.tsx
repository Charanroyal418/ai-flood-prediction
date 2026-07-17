import { redirect } from 'next/navigation';

export default function Home() {
  // Directly redirect to the dashboard as authentication is no longer required
  redirect('/dashboard');
}
