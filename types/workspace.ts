export interface RelatedPaper { id:string; title:string; venue:string; year:string; summary:string; url:string; figure:string }
export interface ResearchTask { id:string; title:string; parentId?:string; start?:string; end?:string; status?:string; goalId?:string; roadmapHidden?:boolean; papers?:RelatedPaper[]; [field:string]:unknown }
export interface ResearchNote { id:string; title:string; papers?:RelatedPaper[]; [field:string]:unknown }
export interface WorkspaceState { version:number; deletedGoalIds?:string[]; deletedTaskIds?:string[]; goals:Record<string,unknown>[]; phases:Record<string,unknown>[]; tasks:ResearchTask[]; notes:ResearchNote[]; references:Record<string,unknown>[]; [field:string]:unknown }
export interface WorkspaceEnvelope { revision:string; state:WorkspaceState; updatedAt?:string }
export interface WorkBootstrap { workspace:WorkspaceEnvelope; taxonomySource:unknown; legacySeed:WorkspaceState; context:{mode:'local'|'supabase'; storageKey:string; role:'reader'|'editor'} }
