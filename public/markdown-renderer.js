// Shared by the preview and server-side PDF renderer.
import {taskLists} from './markdown-editor-core.js';

export const MARKDOWN_OPTIONS = Object.freeze({html:true, linkify:true, typographer:false, breaks:false});

export function createMarkdownEngine(markdownit) {
  return markdownit({...MARKDOWN_OPTIONS}).use(taskLists);
}
