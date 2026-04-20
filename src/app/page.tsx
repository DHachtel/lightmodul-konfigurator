import { redirect } from 'next/navigation';

// Startseite leitet direkt in den Konfigurator
export default function Home() {
  redirect('/configurator');
}
