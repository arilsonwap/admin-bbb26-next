export type QueridometroFeatureMode = 'active' | 'disabled';

export interface QueridometroFeatureState {
  mode: QueridometroFeatureMode;
  title: string;
  message: string;
  buttonLabel: string;
  updatedAt: string;
}
