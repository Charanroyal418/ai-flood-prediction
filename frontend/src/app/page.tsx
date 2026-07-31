import { redirect } from 'next/navigation';

// Server-side redirect to dashboard. Using redirect() instead of
// useRouter (client hook) avoids prerender failures during next build.
export default function Home() {
  redirect('/dashboard');
}
