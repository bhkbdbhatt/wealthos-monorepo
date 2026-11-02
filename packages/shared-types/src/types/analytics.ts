import { AssetType } from '../enums';
import type { IsoDate } from './api';

export interface AnalyticsTimePoint {
  date: IsoDate;
  aumPaise: number;
  sipInflowPaise: number;
  sipOutflowPaise: number;
}

export interface AdvisorAnalyticsDto {
  aumTotalPaise: number;
  liveSipCount: number;
  mrrPaise: number;
  clientCount: number;
  commissionsUpfrontPaise: number;
  commissionsTrailPaise: number;
  timeseries: AnalyticsTimePoint[];
  byAssetClass: Array<{ type: AssetType; currentPaise: number }>;
}
