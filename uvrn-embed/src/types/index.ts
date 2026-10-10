export interface BadgeProps {
  claimId: string;
  apiUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  showScore?: boolean;
  showStatus?: boolean;
  cacheMs?: number;
  className?: string;
}

export interface BadgeData {
  claimId: string;
  status: 'STABLE' | 'DRIFTING' | 'CRITICAL';
  vScore: number;
  cachedAt: number;
}

export type BadgeStatus = 'loading' | 'ready' | 'error';
