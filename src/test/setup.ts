import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { db } from '../data/db';

window.scrollTo = () => {};

afterEach(async () => {
  cleanup();
  await db.plants.clear();
  await db.photos.clear();
  await db.events.clear();
  await db.settings.clear();
});
