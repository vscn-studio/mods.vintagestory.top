import type { Prisma, PrismaClient, ProjectType, ProjectVisibility } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { getDb } from '@/lib/db';
import { writeAudit } from '@/lib/audit';

export const projectInclude = {
  members: { include: { account: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } },
  ownerAccount: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  ownerOrganization: { include: { members: { include: { account: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } } } },
  releases: { include: { files: true }, orderBy: { createdAt: 'desc' as const } },
  tags: { include: { tag: true } },
  categories: { include: { category: true } },
  gameVersions: { include: { gameVersion: true } },
  environments: { include: { environment: true } },
  screenshots: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  _count: { select: { favorites: true, follows: true, comments: true } }
} satisfies Prisma.ProjectInclude;

export type FullProject = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

/**
 * Profile pages need project cards, not releases or files. Keeping this
 * projection separate prevents a public profile request from loading the
 * complete project management graph for every card.
 */
export const profileProjectInclude = {
  tags: { include: { tag: true } }
} satisfies Prisma.ProjectInclude;

export type ProfileProject = Prisma.ProjectGetPayload<{ include: typeof profileProjectInclude }>;

export function slugify(value: string): string {
  const slug = value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  return slug || `project-${randomBytes(5).toString('hex')}`;
}

export async function uniqueProjectSlug(db: PrismaClient, requested: string): Promise<string> {
  const base = slugify(requested);
  let candidate = base;
  for (let index = 2; index < 1000; index += 1) {
    const found = await db.project.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!found) return candidate;
    candidate = `${base.slice(0, 88)}-${index}`;
  }
  throw new Error('Unable to allocate a project slug');
}

export function projectType(value: unknown): ProjectType | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const aliases: Record<string, ProjectType> = {
    mod: 'MOD',
    mods: 'MOD',
    modpack: 'MODPACK',
    modpacks: 'MODPACK',
    'theme-pack': 'THEME_PACK',
    theme_pack: 'THEME_PACK',
    themepack: 'THEME_PACK',
    server: 'SERVER',
    'server-tweak': 'SERVER',
    'server-tweaks': 'SERVER'
  };
  const normalized = aliases[raw] ?? raw.toUpperCase().replace(/-/g, '_');
  return ['MOD', 'MODPACK', 'THEME_PACK', 'SERVER'].includes(normalized) ? normalized as ProjectType : null;
}

export function projectVisibility(value: unknown): ProjectVisibility {
  return typeof value === 'string' && value.toLowerCase() === 'private' ? 'PRIVATE' : 'PUBLIC';
}

export type ProjectTaxonomyInput = {
  tags?: string[];
  categories?: string[];
  gameVersions?: string[];
  environments?: string[];
};

function cleanTaxonomyValues(values: string[] | undefined, limit: number): string[] | undefined {
  if (values === undefined) return undefined;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, ' ');
    if (!value) continue;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value.slice(0, 120));
    if (result.length >= limit) break;
  }
  return result;
}

/** Replace only taxonomy relations present in input; omitted fields are unchanged. */
export async function replaceProjectTaxonomy(
  db: PrismaClient | Prisma.TransactionClient,
  projectId: string,
  input: ProjectTaxonomyInput
): Promise<void> {
  const tags = cleanTaxonomyValues(input.tags, 24);
  if (tags !== undefined) {
    const records = await Promise.all(tags.map(async (name) => {
      const slug = slugify(name).slice(0, 80);
      return db.tag.upsert({ where: { slug }, create: { slug, name }, update: {} });
    }));
    await db.projectTag.deleteMany({ where: { projectId } });
    if (records.length) await db.projectTag.createMany({ data: records.map((tag) => ({ projectId, tagId: tag.id })), skipDuplicates: true });
  }

  const categories = cleanTaxonomyValues(input.categories, 16);
  if (categories !== undefined) {
    const records = await Promise.all(categories.map(async (name) => {
      const slug = slugify(name).slice(0, 80);
      return db.category.upsert({ where: { slug }, create: { slug, name }, update: {} });
    }));
    await db.projectCategory.deleteMany({ where: { projectId } });
    if (records.length) await db.projectCategory.createMany({ data: records.map((category) => ({ projectId, categoryId: category.id })), skipDuplicates: true });
  }

  const gameVersions = cleanTaxonomyValues(input.gameVersions, 32);
  if (gameVersions !== undefined) {
    const records = await Promise.all(gameVersions.map((value) => db.gameVersion.upsert({ where: { value: value.slice(0, 40) }, create: { value: value.slice(0, 40) }, update: {} })));
    await db.projectGameVersion.deleteMany({ where: { projectId } });
    if (records.length) await db.projectGameVersion.createMany({ data: records.map((gameVersion) => ({ projectId, gameVersionId: gameVersion.id })), skipDuplicates: true });
  }

  const environments = cleanTaxonomyValues(input.environments, 16);
  if (environments !== undefined) {
    const records = await Promise.all(environments.map(async (name) => {
      const slug = slugify(name).slice(0, 80);
      return db.environment.upsert({ where: { slug }, create: { slug, name }, update: {} });
    }));
    await db.projectEnvironment.deleteMany({ where: { projectId } });
    if (records.length) await db.projectEnvironment.createMany({ data: records.map((environment) => ({ projectId, environmentId: environment.id })), skipDuplicates: true });
  }
}

export function serializeProject(project: FullProject, options?: { includePrivate?: boolean; includeUncleanFiles?: boolean }) {
  const includePrivate = options?.includePrivate === true;
  const includeUncleanFiles = options?.includeUncleanFiles === true;
  const serializedMembers = project.members.map((member) => ({ id: member.account.id, username: member.account.username, name: member.account.displayName, avatarUrl: member.account.avatarUrl, role: project.ownerAccount?.id === member.account.id ? 'owner' : member.role.toLowerCase() }));
  if (project.ownerAccount && !serializedMembers.some((member) => member.id === project.ownerAccount?.id)) {
    serializedMembers.unshift({ id: project.ownerAccount.id, username: project.ownerAccount.username, name: project.ownerAccount.displayName, avatarUrl: project.ownerAccount.avatarUrl, role: 'owner' });
  }
  return {
    id: project.id,
    slug: project.slug,
    type: project.type.toLowerCase().replace('_', '-'),
    name: { zh: project.name, en: project.nameEn ?? project.name },
    summary: { zh: project.summary, en: project.summaryEn ?? project.summary },
    description: { zh: project.description ?? '', en: project.descriptionEn ?? project.description ?? '' },
    visibility: project.visibility.toLowerCase(),
    status: project.status.toLowerCase(),
    license: project.license,
    links: { repository: project.repositoryUrl, issues: project.issueUrl, wiki: project.wikiUrl, discord: project.discordUrl, sponsor: project.sponsorUrl },
    screenshots: project.screenshots.map((screenshot) => ({ id: screenshot.id, caption: screenshot.caption, url: `/api/v1/media/${screenshot.objectKey.split('/').map(encodeURIComponent).join('/')}`, sortOrder: screenshot.sortOrder })),
    owner: project.ownerOrganization
      ? { type: 'organization', id: project.ownerOrganization.id, slug: project.ownerOrganization.slug, name: project.ownerOrganization.name }
      : project.ownerAccount
        ? { type: 'user', id: project.ownerAccount.id, username: project.ownerAccount.username, name: project.ownerAccount.displayName, avatarUrl: project.ownerAccount.avatarUrl }
        : null,
    members: serializedMembers,
    tags: project.tags.map(({ tag }) => ({ slug: tag.slug, name: tag.name, nameEn: tag.nameEn ?? tag.name })),
    categories: project.categories.map(({ category }) => ({ slug: category.slug, name: category.name, nameEn: category.nameEn ?? category.name })),
    gameVersions: project.gameVersions.map(({ gameVersion }) => gameVersion.value),
    environments: project.environments.map(({ environment }) => ({ slug: environment.slug, name: environment.name, nameEn: environment.nameEn ?? environment.name })),
    releases: project.releases
      .filter((release) => includePrivate || release.status === 'PUBLISHED')
      .map((release) => ({
        id: release.id,
        version: release.version,
        changelog: release.changelog,
        status: release.status.toLowerCase(),
        compatibleVersions: Array.isArray(release.compatibleVersions) ? release.compatibleVersions : [],
        environments: Array.isArray(release.environments) ? release.environments : [],
        publishedAt: release.publishedAt?.toISOString() ?? null,
        updatedAt: release.updatedAt.toISOString(),
        // Draft metadata may be visible to project members, but a file is
        // exposed only after a clean scan unless the caller is explicitly
        // rendering a maintainer/admin management view.
        files: includePrivate || release.status === 'PUBLISHED'
          ? release.files.filter((file) => file.scanStatus === 'CLEAN' || includeUncleanFiles).map((file) => ({ id: file.id, name: file.name, mimeType: file.mimeType, size: Number(file.size), sha256: file.sha256, scanStatus: file.scanStatus.toLowerCase(), downloads: file.downloads }))
          : []
      })),
    stats: { downloads: project.downloadCount ?? project.releases.reduce((sum, release) => sum + release.files.reduce((fileSum, file) => fileSum + file.downloads, 0), 0), followers: project.followerCount ?? project._count.follows, favorites: project.favoriteCount ?? project._count.favorites, comments: project._count.comments },
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

export function serializeProfileProject(project: ProfileProject) {
  return {
    id: project.id,
    slug: project.slug,
    type: project.type.toLowerCase().replace('_', '-'),
    name: { zh: project.name, en: project.nameEn ?? project.name },
    summary: { zh: project.summary, en: project.summaryEn ?? project.summary },
    description: { zh: project.description ?? '', en: project.descriptionEn ?? project.description ?? '' },
    tags: project.tags.map(({ tag }) => ({ slug: tag.slug, name: tag.name, nameEn: tag.nameEn ?? tag.name })),
    stats: {
      downloads: project.downloadCount,
      followers: project.followerCount,
      favorites: project.favoriteCount
    },
    updatedAt: project.updatedAt.toISOString()
  };
}

export async function findProject(db: PrismaClient, idOrSlug: string): Promise<FullProject | null> {
  return db.project.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, include: projectInclude });
}

export async function auditProjectMutation(db: PrismaClient, request: Request, actorId: string, action: string, projectId: string, after: unknown, before?: unknown): Promise<void> {
  await writeAudit(db, request, { actorId, action, resourceType: 'project', resourceId: projectId, before, after });
}

export function dbReady(): PrismaClient | null {
  return getDb();
}
