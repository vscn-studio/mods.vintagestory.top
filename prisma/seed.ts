import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_DEV_DATA !== 'true') {
    console.log('SEED_DEV_DATA is not true; no seed rows were written.');
    return;
  }
  const admin = await prisma.account.upsert({ where: { id: 'mod_local_development_admin' }, update: { status: 'ACTIVE', displayName: 'Local administrator' }, create: { id: 'mod_local_development_admin', username: 'local-admin', displayName: 'Local administrator', bindEmail: 'local-admin@localhost.test' } });
  await prisma.identity.upsert({ where: { provider_subject: { provider: 'COMMUNITY', subject: 'local-admin-development:local-admin' } }, update: { accountId: admin.id, groups: ['管理员'] }, create: { accountId: admin.id, provider: 'COMMUNITY', subject: 'local-admin-development:local-admin', displayName: admin.displayName, providerEmail: admin.bindEmail, providerEmailVerified: true, username: admin.username, groups: ['管理员'] } });
  await prisma.siteRoleAssignment.upsert({ where: { accountId_role: { accountId: admin.id, role: 'ADMIN' } }, update: {}, create: { accountId: admin.id, role: 'ADMIN' } });

  const creator = await prisma.account.upsert({ where: { id: 'mod_local_development_creator' }, update: { status: 'ACTIVE' }, create: { id: 'mod_local_development_creator', username: 'creator', displayName: 'Demo creator', bindEmail: 'creator@localhost.test' } });
  await prisma.identity.upsert({ where: { provider_subject: { provider: 'OFFICIAL', subject: 'vs:local-demo-player' } }, update: { accountId: creator.id }, create: { accountId: creator.id, provider: 'OFFICIAL', subject: 'vs:local-demo-player', displayName: 'Demo player', playerName: 'Demo player', playerUid: 'local-demo-player', providerEmail: creator.bindEmail, providerEmailVerified: true } });
  const organization = await prisma.organization.upsert({ where: { slug: 'stoneworks' }, update: { ownerId: creator.id, archivedAt: null }, create: { slug: 'stoneworks', name: 'Stoneworks', description: 'Development organization', ownerId: creator.id } });
  await prisma.organizationMember.upsert({ where: { organizationId_accountId: { organizationId: organization.id, accountId: creator.id } }, update: { role: 'OWNER' }, create: { organizationId: organization.id, accountId: creator.id, role: 'OWNER' } });

  const project = await prisma.project.upsert({ where: { slug: 'welcome-mod' }, update: { status: 'ACTIVE', visibility: 'PUBLIC', ownerAccountId: creator.id, ownerOrganizationId: null }, create: { slug: 'welcome-mod', type: 'MOD', name: '欢迎模组', nameEn: 'Welcome Mod', summary: '用于开发环境验证的公开项目。', summaryEn: 'A public project for development verification.', description: 'This row is created only when SEED_DEV_DATA=true.', ownerAccountId: creator.id, creatorId: creator.id } });
  await prisma.projectMember.upsert({ where: { projectId_accountId: { projectId: project.id, accountId: creator.id } }, update: { role: 'OWNER' }, create: { projectId: project.id, accountId: creator.id, role: 'OWNER' } });
  const tag = await prisma.tag.upsert({ where: { slug: 'development' }, update: {}, create: { slug: 'development', name: '开发', nameEn: 'Development' } });
  await prisma.projectTag.upsert({ where: { projectId_tagId: { projectId: project.id, tagId: tag.id } }, update: {}, create: { projectId: project.id, tagId: tag.id } });
  console.log(`Seeded ${admin.username}, ${creator.username}, ${organization.slug}, and ${project.slug}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
