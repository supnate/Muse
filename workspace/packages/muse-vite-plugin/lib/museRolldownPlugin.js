import fs from 'fs-extra';
import path from 'path';
import { getMuseIdByPath, getMuseModuleCode, getMuseModule, getLibNameByModule } from './utils.js';
import devUtils from '@ebay/muse-dev-utils/lib/utils.js';

function museRolldownPlugin() {
  const pkgJson = devUtils.getPkgJson();
  const isLibPlugin = pkgJson?.muse?.type === 'lib';
  const usedSharedModules = {};
  const sharedModules = {};

  const MUSE_VIRTUAL_PREFIX = 'virtual:muse-shared?id=';

  let viteConfig;

  const getLibManifest = (pluginContext) => {
    const libManifestContent = {};
    for (const [mid, id] of Object.entries(sharedModules)) {
      // exports seems not used
      const info = pluginContext.getModuleInfo?.(id);
      const exports =
        Array.isArray(info?.exports) && info.exports.length > 0 ? info.exports : undefined;

      libManifestContent[mid] = { id: mid, exports };
    }

    return {
      name: pkgJson.name,
      type: 'lib',
      count: Object.keys(libManifestContent).length,
      content: libManifestContent,
    };
  };

  const checkAndGenerateDevTimeLibManifest = (pluginContext) => {
    if (isLibPlugin && viteConfig?.command === 'serve') {
      const libManifest = getLibManifest(pluginContext);
      fs.writeFileSync(
        path.join(process.cwd(), 'node_modules/.muse/dev/lib-manifest.json'),
        JSON.stringify(libManifest, null, 2),
      );
      console.log(`Generated lib-manifest.json for serve mode.`);
    }
  };

  return {
    name: 'rolldown-plugin-muse',
    enforce: 'post',
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },
    resolveId(id) {
      if (id.startsWith(MUSE_VIRTUAL_PREFIX)) {
        // Tell Rolldown it's a virtual module so that it won't try to resolve it on the filesystem.
        // Virtual module is always es module in which it may load assets like '.png'.
        // So, always use .mjs extension to prevent it being transformed by other plugins like vite-css
        return '\0' + id + '.mjs';
      }
    },
    load(id) {
      if (process.env.VITEST) return;

      // console.log('rolldown load', id);
      // if (id.includes('sub-app/C2SProxyFailed.jsx')) {
      // console.log(this.environment.moduleGraph);
      // }
      // console.log('rolldown load', id);
      // load the virtual module that serves as the registration point for a Muse shared module
      const prefix = '\0' + MUSE_VIRTUAL_PREFIX;
      if (id.startsWith(prefix)) {
        const moduleId = decodeURIComponent(id.slice(prefix.length).replace(/\.mjs$/, ''));
        const mid = getMuseIdByPath(moduleId);
        if (!mid) {
          console.log('no mid for ', id);
          return;
        }
        sharedModules[mid] = moduleId;
        return `import (${JSON.stringify(
          moduleId,
        )}).then(m => MUSE_GLOBAL.__shared__.register({${JSON.stringify(mid)}:m}, () => m));`;
        // return `import * as m from ${JSON.stringify(
        //   moduleId,
        // )};\nMUSE_GLOBAL.__shared__.register({${JSON.stringify(mid)}:m}, () => m);`;
      } else {
        // For normal modules, we check if it's a shared module and return the corresponding code to load it
        // from Muse global shared module registry.

        const museModule = getMuseModule(id);
        if (!museModule) return;
        usedSharedModules[museModule.id] = true;
        const museCode = getMuseModuleCode(museModule);
        return museCode;
      }
    },

    transform(code, id) {
      if (
        !isLibPlugin ||
        id.startsWith('\0') ||
        id.startsWith('/muse-assets/') ||
        id.startsWith('/@') ||
        id.includes('node_modules/.vite/deps/') ||
        id.includes('node_modules/vite/dist')
      ) {
        return;
      }

      const virtualId = MUSE_VIRTUAL_PREFIX + encodeURIComponent(id);
      // console.log('transform', id);
      return { code: code + `\nimport ${JSON.stringify(virtualId)};`, map: null };
    },

    generateBundle(options, bundle) {
      checkAndGenerateDevTimeLibManifest(this);
      if (viteConfig.command === 'serve') {
        // Skip generateBundle for deps manifest in serve mode
        return;
      }
      console.log();

      // Generate lib-manifest.json for lib plugins
      if (isLibPlugin) {
        const libManifest = getLibManifest(this);
        this.emitFile({
          type: 'asset',
          fileName: 'lib-manifest.json',
          source: JSON.stringify(libManifest, null, 2),
        });

        // NOTE: generateBundle will be called for deps prebundling in serve mode,
        // this is necessary to generate lib-manifest for dev purpose
        console.log(
          'Lib manifest generated, provided ' +
            Object.keys(libManifest.content).length +
            ' shared modules',
        );
      }

      // Always generate deps manifest
      const depsManifestContent = {};
      for (const id in usedSharedModules) {
        const libName = getLibNameByModule(id);
        if (!libName) {
          throw new Error('cant find lib name for module', id);
        }
        if (!depsManifestContent[libName]) depsManifestContent[libName] = [];
        depsManifestContent[libName].push(id);
      }
      this.emitFile({
        type: 'asset',
        fileName: 'deps-manifest.json',
        source: JSON.stringify(
          {
            name: pkgJson.name,
            type: pkgJson?.muse?.type || 'normal',
            count: Object.keys(usedSharedModules).length,
            content: depsManifestContent,
          },
          null,
          2,
        ),
      });
      console.log(
        'Deps manifest generated, used ' +
          Object.keys(usedSharedModules).length +
          ' shared modules',
      );

      // For css assets, insert them to the header as links so that they can be loaded before Muse app startst and avoid FOUC.
      let cssInject = `\nconst cssInject = (fileName) => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fileName;
  document.head.appendChild(link);
  return new Promise((resolve, reject) => {
    link.onload = resolve;
    link.onerror = reject;
  });
}\n`;
      Object.values(bundle).forEach((b) => {
        if (b.fileName?.endsWith('.css') && b.type === 'asset') {
          cssInject += `MUSE_GLOBAL.waitFor(cssInject(new URL("${b.fileName}", import.meta.url)));\n`;
        }
      });
      const entryBundle = Object.values(bundle).find((b) => b.isEntry);
      if (!entryBundle) throw new Error('cant find entry bundle');
      entryBundle.code += `\n${cssInject}\n`;
    },
  };
}

export default museRolldownPlugin;
