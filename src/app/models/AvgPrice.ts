import {fuelTypes, User} from "./universal";

export type AvgPrice = {
  Id: string,
  price: number,
  user: User,
  fueltytype: fuelTypes,
  omcId?: string
}

export const emptyprice: AvgPrice = Object.freeze({
  price: null,
  Id: null,
  user: {
    name: null,
    time: null,
    uid: null
  },
  fueltytype: null
});
