import { deepCopy } from '../../../models/utils/deepCopy';
import { MyTimestamp } from '../../firestore/firestoreTypes';
import { FuelType } from './FuelType';
import { EmptyStockQty, StockQty } from './StockQty';

export interface BaseStockModel {
  Amount: number;
  date: Date;
  depot: {
    name: string;
    Id: string;
  };
  qty: StockQty;
  fuelType: FuelType;
  price: number;
  Id: string;
  active: boolean; // 1 for active, 0 for inactive
}

export const EmptyBaseStockModel: BaseStockModel = {
  Id: null,
  fuelType: null,
  Amount: null,
  price: 0,
  qty: deepCopy<StockQty>(EmptyStockQty),
  depot: {
    name: null,
    Id: null
  },
  active: false,
  date: null
};
