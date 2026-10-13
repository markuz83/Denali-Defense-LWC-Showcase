/**
 * Resolves the platform-only modules the Denali components import, so they run unchanged
 * outside Salesforce:
 *   @salesforce/apex/<Class>.<method>  -> a mock method from src/mocks/apexHandlers.js
 *   @salesforce/apex                   -> refreshApex from src/mocks/apexRuntime.js
 *   @salesforce/schema/<Object>.<Field> -> { objectApiName, fieldApiName }
 * and points the lightning/* modules Salesforce provides at runtime (not in
 * lightning-base-components) at the shims in src/mocks/lightning.
 */
import path from 'path';

const PREFIX = '\0sf-mock:';
const mocks = path.resolve('./src/mocks');

export const salesforceMockAliases = {
  'lightning/navigation': path.join(mocks, 'lightning/navigation.js'),
  'lightning/platformShowToastEvent': path.join(mocks, 'lightning/platformShowToastEvent.js'),
  'lightning/uiRecordApi': path.join(mocks, 'lightning/uiRecordApi.js'),
  'lightning/pageReferenceUtils': path.join(mocks, 'lightning/pageReferenceUtils.js'),
  'lightning/empApi': path.join(mocks, 'lightning/empApi.js'),
  'lightning/recordPicker': path.join(mocks, 'lightning/recordPicker/recordPicker.js'),
};

export function salesforceMocksPlugin() {
  return {
    name: 'salesforce-mocks',
    enforce: 'pre',
    resolveId(source) {
      if (source === '@salesforce/apex' || source.startsWith('@salesforce/apex/') || source.startsWith('@salesforce/schema/')) {
        return PREFIX + source;
      }
      if (salesforceMockAliases[source]) {
        return salesforceMockAliases[source];
      }
      return null;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const source = id.slice(PREFIX.length);
      const runtime = JSON.stringify(path.join(mocks, 'apexRuntime.js'));
      if (source === '@salesforce/apex') {
        return `export { refreshApex } from ${runtime};`;
      }
      if (source.startsWith('@salesforce/apex/')) {
        const name = JSON.stringify(source.slice('@salesforce/apex/'.length));
        return `import { createApexMethod } from ${runtime};\nexport default createApexMethod(${name});`;
      }
      const name = JSON.stringify(source.slice('@salesforce/schema/'.length));
      return `import { fieldReference } from ${JSON.stringify(path.join(mocks, 'schema.js'))};\nexport default fieldReference(${name});`;
    },
  };
}
