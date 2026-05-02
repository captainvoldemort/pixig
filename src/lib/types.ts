export type OutputType = 'studio' | 'lifestyle' | 'poster';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  product_description: string;
  image_url: string | null;
  created_at: string;
}

export interface Version {
  id: string;
  project_id: string;
  created_at: string;
  diagnosis: Diagnosis;
  prompt: string | null;
}

export interface Output {
  id: string;
  version_id: string;
  type: OutputType;
  image_url: string;
  hook: string;
  caption: string;
  reasoning: string;
}

export interface Diagnosis {
  whats_wrong: string[];
  whats_missing: string[];
  summary: string;
}

export interface AIGenerationPlan {
  diagnosis: Diagnosis;
  outputs: {
    type: OutputType;
    image_prompt: string;
    hook: string;
    caption: string;
    reasoning: string;
  }[];
}

export interface VersionWithOutputs extends Version {
  outputs: Output[];
}

export interface ProjectWithVersions extends Project {
  versions: VersionWithOutputs[];
}
