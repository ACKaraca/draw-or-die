// Deployment hook placeholder for CI/CD pipelines.
// Uses fixed provider allow-list and deterministic command mapping.

const PROVIDERS = Object.freeze({
  vercel: 'vercel --prod',
  railway: 'railway up',
  fly: 'fly deploy',
  render: 'render deploy',
  aws: 'aws deploy push',
  gcloud: 'gcloud app deploy',
  azure: 'az webapp up',
});

function resolveDeployProvider() {
  const requested = String(process.env.DEPLOY_PROVIDER ?? '').trim().toLowerCase();
  if (requested && PROVIDERS[requested]) return requested;
  return '';
}

const provider = resolveDeployProvider();

if (!provider) {
  console.log(
    '[deploy:prod] DEPLOY_PROVIDER tanimli degil veya izinli degil. Desteklenenler: vercel, railway, fly, render, aws, gcloud, azure.',
  );
  process.exit(0);
}

const command = PROVIDERS[provider];
console.log('[deploy:prod] Harici deploy komutu CI tarafindan calistirilmali:', command);
process.exit(0);
