import { getMuseModuleCode, getMuseModule } from './utils.js';

function museRolldownPlugin() {
  return {
    name: 'rolldown-plugin-muse',
    load(id) {
      // Special support for vitest
      if (process.env.VITEST) return;
      const museModule = getMuseModule(id);

      if (!museModule) return;
      const museCode = getMuseModuleCode(museModule);

      if (museCode) {
        return museCode;
      }
      return null;
    },
  };
}

export default museRolldownPlugin;
