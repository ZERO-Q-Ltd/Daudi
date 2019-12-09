
import { FuelType } from "./FuelType";
import { MyTimestamp } from "../../firestore/firestoreTypes";


export interface Entry {

  Amount: number;
  date: MyTimestamp;
  batch: string;
  depot: {
    name: string
    Id: string
  };
  qty: {
    /**
     * The total quantity that has been loaded directly at
     * any KPC Depot
     */
    total: number;
    directLoad: {
      total: number,
      accumulated: {
        total: number,
        usable: number
      };
    },
    /**
     * Total transfered to a private depot WITH ASE's
     */
    transfered: number

  };
  // vessel:{

  // }
  fuelType: FuelType;
  price: number;
  Id: string;
  active: number; // 1 for active, 0 for inactive
}

export const emptybatches: Entry = {
  Id: null,
  fuelType: null,
  Amount: null,
  batch: null,
  price: 0,
  qty: {
    total: 0,
    directLoad: {
      accumulated: {
        total: 0,
        usable: 0
      },
      total: 0
    },
    transfered: 0,

  },

  depot: {
    name: null,
    Id: null
  },
  active: 1,
  date: new MyTimestamp(0, 0)
};
