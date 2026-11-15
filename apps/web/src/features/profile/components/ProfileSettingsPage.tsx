import { CardProfileEditor } from './CardProfileEditor';

export default function ProfileSettingsPage({
  searchParams,
}: {
  searchParams?: { card?: string };
}) {
  return <CardProfileEditor initialCardId={searchParams?.card} />;
}
