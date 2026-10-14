import fs from 'node:fs';
import path from 'node:path';
import ExperienceLoader from '@/components/ExperienceLoader';

/** Supplied art, if any. Resolved at build time so the browser never requests a missing file. */
const CHARACTER_FILES = ['character.png', 'character.webp', 'character.jpg', 'character.jpeg'];

function findCharacterAsset(): string | null {
  const dir = path.join(process.cwd(), 'public', 'assets');
  for (const file of CHARACTER_FILES) {
    if (fs.existsSync(path.join(dir, file))) return `/assets/${file}`;
  }
  return null;
}

export default function Page() {
  return <ExperienceLoader characterSrc={findCharacterAsset()} />;
}
