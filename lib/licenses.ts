export type LicenseOption = {
  value: string;
  label: string;
  href: string;
};

export type LicenseGroup = {
  id: string;
  label: { 'zh-CN': string; en: string };
  options: readonly LicenseOption[];
};

function spdx(value: string, label = value): LicenseOption {
  return { value, label, href: `https://spdx.org/licenses/${value}.html` };
}

export const LICENSE_GROUPS: readonly LicenseGroup[] = [
  {
    id: 'public-domain',
    label: { 'zh-CN': '公共领域与知识共享', en: 'Public domain and Creative Commons' },
    options: [
      spdx('CC0-1.0', 'CC0 1.0 Universal'),
      spdx('CC-BY-4.0', 'Creative Commons Attribution 4.0'),
      spdx('CC-BY-SA-4.0', 'Creative Commons Attribution Share Alike 4.0'),
      spdx('CC-BY-NC-4.0', 'Creative Commons Attribution Non Commercial 4.0'),
      spdx('CC-BY-NC-SA-4.0', 'Creative Commons Attribution Non Commercial Share Alike 4.0'),
      spdx('CC-BY-ND-4.0', 'Creative Commons Attribution No Derivatives 4.0'),
      spdx('CC-BY-NC-ND-4.0', 'Creative Commons Attribution Non Commercial No Derivatives 4.0'),
      spdx('CC-PDDC', 'Creative Commons Public Domain Dedication and Certification'),
      spdx('Unlicense', 'The Unlicense')
    ]
  },
  {
    id: 'permissive',
    label: { 'zh-CN': '宽松开源许可证', en: 'Permissive open source' },
    options: [
      spdx('0BSD', 'BSD Zero Clause License'),
      spdx('MIT', 'MIT License'),
      spdx('MIT-0', 'MIT No Attribution License'),
      spdx('Apache-2.0', 'Apache License 2.0'),
      spdx('BSD-2-Clause', 'BSD 2-Clause License'),
      spdx('BSD-3-Clause', 'BSD 3-Clause License'),
      spdx('BSD-4-Clause', 'BSD 4-Clause License'),
      spdx('ISC', 'ISC License'),
      spdx('Zlib', 'zlib License'),
      spdx('BSL-1.0', 'Boost Software License 1.0'),
      spdx('BlueOak-1.0.0', 'Blue Oak Model License 1.0.0'),
      spdx('NCSA', 'NCSA Open Source License'),
      spdx('PostgreSQL', 'PostgreSQL License'),
      spdx('Python-2.0', 'Python License 2.0'),
      spdx('WTFPL', 'Do What The F*ck You Want To Public License')
    ]
  },
  {
    id: 'weak-copyleft',
    label: { 'zh-CN': '弱著佐权许可证', en: 'Weak copyleft' },
    options: [
      spdx('MPL-2.0', 'Mozilla Public License 2.0'),
      spdx('EPL-2.0', 'Eclipse Public License 2.0'),
      spdx('CDDL-1.0', 'Common Development and Distribution License 1.0'),
      spdx('LGPL-2.1-only', 'GNU Lesser General Public License v2.1 only'),
      spdx('LGPL-2.1-or-later', 'GNU Lesser General Public License v2.1 or later'),
      spdx('LGPL-3.0-only', 'GNU Lesser General Public License v3.0 only'),
      spdx('LGPL-3.0-or-later', 'GNU Lesser General Public License v3.0 or later')
    ]
  },
  {
    id: 'strong-copyleft',
    label: { 'zh-CN': '强著佐权许可证', en: 'Strong copyleft' },
    options: [
      spdx('GPL-2.0-only', 'GNU General Public License v2.0 only'),
      spdx('GPL-2.0-or-later', 'GNU General Public License v2.0 or later'),
      spdx('GPL-3.0-only', 'GNU General Public License v3.0 only'),
      spdx('GPL-3.0-or-later', 'GNU General Public License v3.0 or later'),
      spdx('AGPL-3.0-only', 'GNU Affero General Public License v3.0 only'),
      spdx('AGPL-3.0-or-later', 'GNU Affero General Public License v3.0 or later'),
      spdx('OSL-3.0', 'Open Software License 3.0'),
      spdx('AFL-3.0', 'Academic Free License 3.0'),
      spdx('EUPL-1.2', 'European Union Public License 1.2')
    ]
  },
  {
    id: 'other',
    label: { 'zh-CN': '其他常用许可证', en: 'Other common licenses' },
    options: [
      spdx('Artistic-2.0', 'Artistic License 2.0'),
      spdx('CECILL-2.1', 'CeCILL Free Software License Agreement v2.1'),
      spdx('CECILL-B', 'CeCILL-B Free Software License Agreement'),
      spdx('CECILL-C', 'CeCILL-C Free Software License Agreement'),
      spdx('MS-PL', 'Microsoft Public License'),
      spdx('MS-RL', 'Microsoft Reciprocal License'),
      spdx('OFL-1.1', 'SIL Open Font License 1.1'),
      spdx('OpenSSL', 'OpenSSL License'),
      spdx('UPL-1.0', 'Universal Permissive License v1.0'),
      spdx('Unicode-DFS-2016', 'Unicode License Agreement - Data Files and Software'),
      spdx('Vim', 'Vim License'),
      spdx('X11', 'X11 License')
    ]
  },
  {
    id: 'proprietary',
    label: { 'zh-CN': '保留所有权利', en: 'All rights reserved' },
    options: [
      { value: 'LicenseRef-All-Rights-Reserved', label: 'All Rights Reserved', href: 'https://choosealicense.com/no-permission/' }
    ]
  }
];

const licenseByValue = new Map(LICENSE_GROUPS.flatMap((group) => group.options).map((license) => [license.value, license]));

export function getLicenseOption(value: string | null | undefined): LicenseOption | undefined {
  return value ? licenseByValue.get(value) : undefined;
}

export function isSupportedLicense(value: string): boolean {
  return licenseByValue.has(value);
}
