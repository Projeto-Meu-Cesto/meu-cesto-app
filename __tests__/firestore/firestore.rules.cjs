const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');

async function main() {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  const environment = await initializeTestEnvironment({
    projectId: 'meu-cesto-rules-test',
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });

  try {
    const ownerDb = environment.authenticatedContext('user-a').firestore();
    const otherDb = environment.authenticatedContext('user-b').firestore();
    const anonymousDb = environment.unauthenticatedContext().firestore();
    const ownItem = doc(ownerDb, 'users/user-a/shopping_list/item-1');

    await assertSucceeds(setDoc(ownItem, { name: 'Arroz', createdAt: '2026-08-08T12:00:00.000Z' }));
    await assertSucceeds(getDoc(ownItem));
    await assertFails(getDoc(doc(otherDb, 'users/user-a/shopping_list/item-1')));
    await assertFails(getDoc(doc(anonymousDb, 'product_cache/7890000000000')));
    await assertFails(setDoc(doc(ownerDb, 'product_cache/7890000000000'), { barcode: '7890000000000', name: 'Produto' }));
    console.log('Firestore rules: owner isolation and catalog protection passed.');
  } finally {
    await environment.cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
