import { Account, Client, Databases } from 'appwrite';

const APPWRITE_PUBLIC_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim() ||
  'https://fra.cloud.appwrite.io/v1';

const APPWRITE_PUBLIC_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim() ||
  'draw-or-die';

const client = new Client()
  .setEndpoint(APPWRITE_PUBLIC_ENDPOINT)
  .setProject(APPWRITE_PUBLIC_PROJECT_ID);

const account = new Account(client);
const databases = new Databases(client);

export { client, account, databases };
