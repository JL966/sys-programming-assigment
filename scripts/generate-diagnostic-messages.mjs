import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {renderDiagnosticMessageMarkdown} from '../web/js/diagnostic-messages.js';

const destination=fileURLToPath(new URL('../诊断异常原因与处理建议.md',import.meta.url));
await writeFile(destination,renderDiagnosticMessageMarkdown(),'utf8');
console.log(destination);
