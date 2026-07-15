import { access, mkdir, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import type { CandidateResume, ResumeTemplateId } from '../../types/resume.js';
import { renderResumeHtml } from './resume-html.service.js';

interface ResumePdfRenderer {
  close(): Promise<void>;
  render(candidate: CandidateResume, template: ResumeTemplateId): Promise<Buffer>;
}

const DEFAULT_PUPPETEER_CACHE_DIRECTORY = path.join(os.tmpdir(), 'cv-asker-puppeteer-cache');
const CHROMIUM_RUNTIME_DIRECTORY = path.join(os.tmpdir(), 'cv-asker-chromium-runtime');
const CHROMIUM_PROFILE_DIRECTORY = path.join(os.tmpdir(), 'cv-asker-chromium-profile');
const COMMON_BROWSER_PATHS = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/chromium/current/usr/lib/chromium-browser/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const stylesCache = new Map<ResumeTemplateId, string>();

async function loadTemplateStyles(template: ResumeTemplateId): Promise<string> {
  const cached = stylesCache.get(template);

  if (cached) {
    return cached;
  }

  const stylesPath = new URL(`./templates/${template}.generated.css`, import.meta.url);
  const styles = await readFile(stylesPath, 'utf8');
  stylesCache.set(template, styles);
  return styles;
}

async function resolveChromiumExecutablePath(): Promise<string | undefined> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  try {
    const executablePath = await puppeteer.executablePath();
    await access(executablePath);
    return executablePath;
  } catch {
    // Ignore missing Puppeteer-managed browsers and continue through the fallback chain.
  }

  try {
    const managedChromiumCacheDirectory = path.join(
      process.env.PUPPETEER_CACHE_DIR ?? DEFAULT_PUPPETEER_CACHE_DIRECTORY,
      'chrome'
    );
    const installedVersions = (await readdir(managedChromiumCacheDirectory))
      .filter((entry) => entry.startsWith('linux-'))
      .sort();

    const latestVersion = installedVersions.at(-1);

    if (latestVersion) {
      const managedExecutablePath = path.join(
        managedChromiumCacheDirectory,
        latestVersion,
        'chrome-linux64',
        'chrome'
      );

      await access(managedExecutablePath);
      return managedExecutablePath;
    }
  } catch {
    // Ignore cache lookup errors and continue through the fallback chain.
  }

  for (const browserPath of COMMON_BROWSER_PATHS) {
    try {
      await access(browserPath);
      return browserPath;
    } catch {
      // Continue to the next candidate.
    }
  }

  return undefined;
}

async function launchBrowser(): Promise<Browser> {
  const executablePath = await resolveChromiumExecutablePath();
  const usesSnapBrowser = executablePath?.includes('/snap/') ?? false;

  await mkdir(CHROMIUM_RUNTIME_DIRECTORY, { recursive: true });
  await mkdir(CHROMIUM_PROFILE_DIRECTORY, { recursive: true });

  return puppeteer.launch({
    headless: true,
    executablePath,
    userDataDir: CHROMIUM_PROFILE_DIRECTORY,
    env: {
      ...process.env,
      ...(usesSnapBrowser
        ? {
            HOME: os.tmpdir(),
            XDG_RUNTIME_DIR: CHROMIUM_RUNTIME_DIRECTORY,
          }
        : {}),
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-crash-reporter',
      '--disable-crashpad',
      '--disable-breakpad',
      '--no-crashpad',
    ],
  });
}

export async function createResumePdfRenderer(): Promise<ResumePdfRenderer> {
  const browser = await launchBrowser();

  return {
    async close() {
      await browser.close();
    },
    async render(candidate, template) {
      const styles = await loadTemplateStyles(template);
      const page = await browser.newPage();

      try {
        await page.setViewport({
          width: 1240,
          height: 1754,
          deviceScaleFactor: 1,
        });
        await page.setContent(renderResumeHtml(candidate, { styles, template }), {
          waitUntil: 'load',
        });
        await page.waitForNetworkIdle();
        await page.emulateMediaType('screen');

        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '0',
            right: '0',
            bottom: '0',
            left: '0',
          },
          preferCSSPageSize: true,
        });

        return Buffer.from(pdf);
      } finally {
        await page.close();
      }
    },
  };
}
