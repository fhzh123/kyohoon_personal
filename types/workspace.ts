export interface ResearchTask { id:string; title:string; parentId?:string; start?:string; end?:string; status?:string; goalId?:string; [field:string]:unknown }
export interface WorkspaceState { version:number; goals:Record<string,unknown>[]; phases:Record<string,unknown>[]; tasks:ResearchTask[]; notes:Record<string,unknown>[]; references:Record<string,unknown>[]; [field:string]:unknown }
export interface WorkspaceEnvelope { revision:string; state:WorkspaceState; updatedAt?:string }
export interface WorkBootstrap { workspace:WorkspaceEnvelope; taxonomySource:unknown; legacySeed:WorkspaceState; context:{mode:'local'|'supabase'; storageKey:string; role:'reader'|'editor'} }
